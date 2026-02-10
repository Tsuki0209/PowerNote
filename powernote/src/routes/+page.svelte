<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { onMount } from 'svelte';
	import toast, { Toaster } from 'svelte-french-toast';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Select from '$lib/components/Select.svelte';
	import TabManager from '$lib/components/TabManager.svelte';
	import { slide } from 'svelte/transition';

	let user = $state<any>(null);
	let files = $state<any[]>([]);
	let isSidebarOpen = $state(true);
	let showModal = $state<'create' | 'import' | 'actions' | 'rename' | 'delete-confirm' | null>(
		null
	);
	let pendingImport = $state<{
		name: string;
		content: string;
		extension: string;
		size: number;
	} | null>(null);

	let newTagName = $state('');
	let showTagEditModal = $state(false);
	let editingTag = $state<{ id: string; name: string; color: string } | null>(null);
	let draggedTagIndex = $state<number | null>(null);

	async function addTag(e: KeyboardEvent) {
		if (e.key === 'Enter' && newTagName.trim() && targetItem) {
			e.preventDefault();
			const name = newTagName.trim();

			// すでに同じ名前のタグがこのアイテムにある場合はスキップ
			if ((targetItem.tags || []).some((t: any) => t.name === name)) {
				newTagName = '';
				return;
			}

			// 全ファイルから同じ名前のタグを探して色とIDを同期（共有の擬似実現）
			const existingTag = files.flatMap((f) => f.tags || []).find((t: any) => t.name === name);

			const newTag = existingTag
				? { ...existingTag } // 既存があればそれを使う
				: { id: crypto.randomUUID(), name, color: '#4f46e5' }; // 新規

			const currentTags = targetItem.tags || [];
			const { error } = await supabase
				.from('files')
				.update({ tags: [...currentTags, newTag] })
				.eq('id', targetItem.id);

			if (!error) {
				targetItem.tags = [...currentTags, newTag];
				newTagName = '';
				await fetchFiles();
			}
		}
	}
	async function removeTag(tagId: string) {
		if (!targetItem) return;
		const updatedTags = (targetItem.tags || []).filter((t: any) => t.id !== tagId);
		const { error } = await supabase
			.from('files')
			.update({ tags: updatedTags })
			.eq('id', targetItem.id);
		if (!error) {
			targetItem.tags = updatedTags;
			await fetchFiles();
		}
	}

	const tagPresets = [
		'#ef4444',
		'#f97316',
		'#f59e0b',
		'#10b981',
		'#06b6d4',
		'#3b82f6',
		'#6366f1',
		'#8b5cf6',
		'#d946ef',
		'#64748b'
	];
	// --- タグ詳細（色・名前）の同期更新 ---
	async function updateTagDetail() {
		if (!targetItem || !editingTag) return;

		// 1. 同期対象の元のタグ名を特定
		const originalTag = targetItem.tags.find((t: any) => t.id === editingTag!.id);
		const originalName = originalTag?.name;

		// 2. ローカルの状態 (files) を即座に更新してUIに反映させる
		// これによりモーダル内の表示や背後のエディタ表示が即座に変わります
		files = files.map((file) => {
			if (!file.tags) return file;

			const newTags = file.tags.map((t: any) => {
				// IDが一致、または名前が一致するタグをすべて同期
				if (t.id === editingTag!.id || (originalName && t.name === originalName)) {
					return { ...editingTag };
				}
				return t;
			});

			// targetItemもfilesの参照の一部なので、ここで一致するものを更新
			if (file.id === targetItem.id) {
				targetItem.tags = newTags;
			}

			return { ...file, tags: newTags };
		});

		// 3. データベース（Supabase）への一括反映
		const updatePromises = files
			.filter((f) => f.tags?.some((t: any) => t.id === editingTag!.id || t.name === originalName))
			.map((f) => supabase.from('files').update({ tags: f.tags }).eq('id', f.id));

		const results = await Promise.all(updatePromises);

		if (results.every((r) => !r.error)) {
			showTagEditModal = false; // 保存成功時に閉じる
			toast.success('Tags synchronized across all files');
		} else {
			toast.error('Failed to sync some files');
			await fetchFiles(); // 失敗した場合は再取得して整合性を戻す [cite: 42]
		}
	}
	async function handleTagDrop(targetIndex: number) {
		if (draggedTagIndex === null || !targetItem) return;
		const updatedTags = [...(targetItem.tags || [])];
		const [draggedTag] = updatedTags.splice(draggedTagIndex, 1);
		updatedTags.splice(targetIndex, 0, draggedTag);
		const { error } = await supabase
			.from('files')
			.update({ tags: updatedTags })
			.eq('id', targetItem.id);
		if (!error) {
			targetItem.tags = updatedTags;
			draggedTagIndex = null;
			await fetchFiles();
		}
	}

	// --- スクリプト内の適切な場所（変数定義付近）に追加 ---

	let isTagInputFocused = $state(false); // フォーカス状態の管理 [cite: 108]

	// 全ファイルからユニークな既存タグを抽出 + デフォルトタグ [cite: 141]
	const defaultTags = ['仕事', '個人', 'アイデア'];
	let tagSuggestions = $derived(() => {
		const existingTags = files.flatMap((f) => f.tags || []).map((t: any) => t.name);
		const combined = [...defaultTags, ...existingTags];
		return [...new Set(combined)]; // 重複を排除
	});

	// 候補をクリックして追加する関数 [cite: 112, 113]
	async function addSuggestedTag(tagName: string) {
		if (!targetItem) return;
		if ((targetItem.tags || []).some((t: any) => t.name === tagName)) {
			newTagName = '';
			return;
		}

		// 既存のタグ情報を取得（色などを引き継ぐ）
		const sharedTag = files.flatMap((f) => f.tags || []).find((t: any) => t.name === tagName);

		const newTag = sharedTag
			? { ...sharedTag }
			: { id: crypto.randomUUID(), name: tagName, color: '#4f46e5' };

		const currentTags = targetItem.tags || [];
		const { error } = await supabase
			.from('files')
			.update({ tags: [...currentTags, newTag] })
			.eq('id', targetItem.id);

		if (!error) {
			targetItem.tags = [...currentTags, newTag];
			newTagName = '';
			await fetchFiles();
		}
	}

	// --- 制限設定 ---
	const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
	const MAX_TOTAL_SIZE = 500 * 1024 * 1024; // 500MB (Supabase Free Tier)

	// 全ファイルの合計サイズを計算 (Base64は約3/4、テキストはそのまま)
	let totalSize = $derived(
		files.reduce((acc, f) => {
			if (!f.content) return acc;
			const size = f.content.startsWith('data:')
				? Math.round((f.content.length * 3) / 4)
				: new Blob([f.content]).size;
			return acc + size;
		}, 0)
	);

	// --- 画面分割・状態記憶管理 ---
	type LayoutMode = '1' | 'V2' | 'H2' | 'V3' | 'Grid4' | 'Grid6';
	let layoutMode = $state<LayoutMode>('1');
	let activeViewIndex = $state(0);
	let viewStates = $state<string[]>(['']);
	let tabs = $derived(
		files
			.filter((f) => f.is_open)
			.sort((a, b) => {
				if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
				return a.sort_order - b.sort_order;
			})
	);
	let activeTabId = $derived(viewStates[activeViewIndex] || null);

	$effect(() => {
		if (files.length > 0) {
			const state = { layoutMode, viewStates, activeViewIndex };
			localStorage.setItem('powernote_split_config', JSON.stringify(state));
		}
	});
	// --- オートセーブ (テキストファイルのみ) ---
	// +page.svelte のオートセーブ部分を修正
	let autoSaveTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

	$effect(() => {
		// 編集中の特定のファイルだけを追跡するようにする
		const openFiles = files.filter((f) => f.is_open && isTextFile(f.extension));

		openFiles.forEach((f) => {
			const content = f.content;
			const id = f.id;

			// すでにタイマーがあればクリア
			if (autoSaveTimeouts.has(id)) {
				clearTimeout(autoSaveTimeouts.get(id));
			}

			// 個別にタイマーを設定
			const timeout = setTimeout(async () => {
				const { error } = await supabase.from('files').update({ content }).eq('id', id);
				if (!error) {
					// 保存成功時のみ、特定のフラグを立てるなどの処理が可能
					autoSaveTimeouts.delete(id);
				}
			}, 800); // 500msだと短すぎて競合しやすいため、少し伸ばすと安定します

			autoSaveTimeouts.set(id, timeout);
		});
	});

	let draggingTabId = $state<string | null>(null);
	let targetItem = $state<any>(null);
	let activeView = $state<'editor' | 'settings'>('editor');
	let isDarkMode = $state(true);
	let createType = $state<'file' | 'folder'>('file');
	let newName = $state('');
	let targetFolderId = $state<string | null>(null);
	let scrollContainer = $state<HTMLDivElement | null>(null);
	let canScrollLeft = $state(false);
	let canScrollRight = $state(false);

	let folders = $derived(files.filter((f) => f.is_folder));
	let folderOptions = $derived([
		{ id: null, name: '/ Root' },
		...folders
			.filter((f) => {
				// アクション（移動）モーダル表示中の場合、自分自身と子孫フォルダは選択肢から除外する
				if (showModal === 'actions' && targetItem?.is_folder) {
					return !isDescendant(f.id, targetItem.id);
				}
				return true;
			})
			.map((f) => ({ id: f.id, name: f.name }))
	]);
	// --- ヘルパー関数 ---
	function isImage(ext: string) {
		return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext?.toLowerCase());
	}
	function isVideo(ext: string) {
		return ['mp4', 'webm', 'ogg'].includes(ext?.toLowerCase());
	}
	function isTextFile(ext: string) {
		return !isImage(ext) && !isVideo(ext);
	}
	// --- 既存のヘルパー関数の付近に追加 ---
	function isNameDuplicate(
		name: string,
		extension: string | null,
		parentId: string | null,
		excludeId?: string
	) {
		return files.some(
			(f) =>
				f.name === name &&
				f.extension === extension &&
				f.parent_id === parentId &&
				f.id !== excludeId
		);
	}

	// 循環移動防止：指定したフォルダが自分自身または子孫かどうかを判定
	function isDescendant(folderId: string | null, targetId: string): boolean {
		if (!folderId) return false;
		if (folderId === targetId) return true;
		const parent = files.find((f) => f.id === folderId);
		return parent ? isDescendant(parent.parent_id, targetId) : false;
	}

	async function login() {
		await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo:
					window.location.origin + (window.location.hostname === 'localhost' ? '' : '/PowerNote')
			}
		});
	}

	async function logout() {
		await supabase.auth.signOut();
		user = null;
		files = [];
	}

	async function fetchFiles() {
		if (!user) return;
		const { data } = await supabase
			.from('files')
			.select('*')
			.eq('user_id', user.id)
			.order('sort_order', { ascending: true });
		files = data || [];
		const saved = localStorage.getItem('powernote_split_config');
		if (saved) {
			const config = JSON.parse(saved);
			layoutMode = config.layoutMode;
			viewStates = config.viewStates;
			activeViewIndex = config.activeViewIndex;
		}
	}

	async function handleSelect(file: any) {
		if (file.is_folder) return;
		activeView = 'editor';
		viewStates[activeViewIndex] = file.id;
		if (!file.is_open) {
			const { error } = await supabase.from('files').update({ is_open: true }).eq('id', file.id);
			if (!error) {
				const f = files.find((item) => item.id === file.id);
				if (f) f.is_open = true;
			}
		}
		setTimeout(checkScroll, 50);
	}

	function openItemActions(item: any) {
		targetItem = item;
		targetFolderId = item.parent_id;
		newName = item.name;
		showModal = 'actions';
	}

	async function closeTab(id: string, event?: MouseEvent) {
		event?.stopPropagation();
		const { error } = await supabase.from('files').update({ is_open: false }).eq('id', id);
		if (!error) {
			const f = files.find((item) => item.id === id);
			if (f) f.is_open = false;
			viewStates = viewStates.map((v) => (v === id ? '' : v));
		}
		setTimeout(checkScroll, 50);
	}

	async function saveToDevice() {
		if (!targetItem || targetItem.is_folder) return;
		try {
			const ext = targetItem.extension || 'txt';
			let contentToSave: Blob | string = targetItem.content;

			if (typeof targetItem.content === 'string' && targetItem.content.startsWith('data:')) {
				const response = await fetch(targetItem.content);
				contentToSave = await response.blob();
			}

			const handle = await (window as any).showSaveFilePicker({
				suggestedName: `${targetItem.name}.${ext}`,
				types: [
					{
						description: `${ext.toUpperCase()} File`,
						accept: {
							[(contentToSave as Blob).type || 'application/octet-stream']: [`.${ext}`]
						}
					}
				]
			});
			const writable = await handle.createWritable();
			await writable.write(contentToSave);
			await writable.close();

			toast.success('Saved to device');
			showModal = null;
		} catch (err: any) {
			if (err.name !== 'AbortError') toast.error('Failed to save to device');
		}
	}

	function handleDragStart(id: string) {
		draggingTabId = id;
	}
	function handleDragOver(e: DragEvent, targetId: string) {
		e.preventDefault();
		if (!draggingTabId || draggingTabId === targetId) return;
		const draggingTab = files.find((f) => f.id === draggingTabId);
		const targetTab = files.find((f) => f.id === targetId);
		if (draggingTab?.is_pinned !== targetTab?.is_pinned) return;
		const fromIndex = files.findIndex((f) => f.id === draggingTabId);
		const toIndex = files.findIndex((f) => f.id === targetId);
		const newFiles = [...files];
		const [movedItem] = newFiles.splice(fromIndex, 1);
		newFiles.splice(toIndex, 0, movedItem);
		files = newFiles.map((f, i) => ({ ...f, sort_order: i }));
	}

	async function handleDragEnd() {
		draggingTabId = null;
		const promises = files.map((f) =>
			supabase.from('files').update({ sort_order: f.sort_order }).eq('id', f.id)
		);
		await Promise.all(promises);
		await fetchFiles();
	}

	async function updateItem() {
		if (!targetItem || !newName) return;

		// 1. 名前重複チェック
		if (isNameDuplicate(newName, targetItem.extension, targetFolderId, targetItem.id)) {
			return toast.error('An item with this name already exists in this folder');
		}

		// 2. 循環参照チェック (フォルダの場合のみ)
		if (targetItem.is_folder && isDescendant(targetFolderId, targetItem.id)) {
			return toast.error('Cannot move a folder into itself or its subfolders');
		}

		const { error } = await supabase
			.from('files')
			.update({ name: newName, parent_id: targetFolderId })
			.eq('id', targetItem.id);
		if (error) toast.error('Update failed');
		else {
			await fetchFiles();
			closeModals();
			toast.success('Updated');
		}
	}

	async function deleteItem() {
		if (!targetItem) return;
		const idToDelete = targetItem.id;
		const { error } = await supabase.from('files').delete().eq('id', idToDelete);
		if (error) toast.error('Delete failed');
		else {
			viewStates = viewStates.map((v) => (v === idToDelete ? '' : v));
			await fetchFiles();
			closeModals();
			toast.success('Deleted');
		}
	}

	async function togglePin() {
		if (!targetItem || targetItem.is_folder) return;
		const newPinned = !targetItem.is_pinned;
		await supabase.from('files').update({ is_pinned: newPinned }).eq('id', targetItem.id);
		await fetchFiles();
		showModal = null;
		setTimeout(checkScroll, 50);
	}

	function checkScroll() {
		if (!scrollContainer) return;
		const { scrollLeft, scrollWidth, clientWidth } = scrollContainer;
		canScrollLeft = scrollLeft > 1;
		canScrollRight = scrollLeft < scrollWidth - clientWidth - 1;
	}

	function scrollTabs(direction: 'left' | 'right') {
		if (!scrollContainer) return;
		scrollContainer.scrollBy({ left: direction === 'left' ? -240 : 240, behavior: 'smooth' });
	}

	function handleWheel(e: WheelEvent) {
		if (!scrollContainer) return;
		if (e.deltaY !== 0) {
			e.preventDefault();
			scrollContainer.scrollLeft += e.deltaY;
			checkScroll();
		}
	}

	function toggleTheme() {
		isDarkMode = !isDarkMode;
		document.documentElement.classList.toggle('dark', isDarkMode);
	}

	function closeModals() {
		showModal = null;
		newName = '';
		targetFolderId = null;
		targetItem = null;
		pendingImport = null;
	}

	async function handleCreate() {
		if (!newName) return toast.error('Name required');
		const isFolder = createType === 'folder';
		const ext = isFolder ? null : 'txt';

		// 重複チェック
		if (isNameDuplicate(newName, ext, targetFolderId)) {
			return toast.error('An item with this name already exists in this folder');
		}

		const { error } = await supabase.from('files').insert([
			{
				name: newName,
				extension: ext,
				is_folder: isFolder,
				parent_id: targetFolderId,
				content: '',
				sort_order: files.length,
				is_open: !isFolder,
				user_id: user.id
			}
		]);

		if (error) toast.error('Error creating item');
		else {
			closeModals();
			await fetchFiles();
		}
	}

	function formatSize(bytes: number) {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	function processFile(file: File) {
		if (file.size > MAX_FILE_SIZE) {
			return toast.error('File size exceeds 50MB limit');
		}
		if (totalSize + file.size > MAX_TOTAL_SIZE) {
			return toast.error('Total storage limit exceeded (500MB)');
		}

		const extension = file.name.split('.').pop() || 'txt';
		const reader = new FileReader();
		reader.onload = (e) => {
			pendingImport = {
				name: file.name.split('.').slice(0, -1).join('.') || file.name,
				extension: extension,
				content: e.target?.result as string,
				size: file.size
			};
		};
		if (isImage(extension) || isVideo(extension)) {
			reader.readAsDataURL(file);
		} else {
			reader.readAsText(file);
		}
	}

	async function confirmImport() {
		if (!pendingImport) return;
		// 重複チェック
		if (isNameDuplicate(pendingImport.name, pendingImport.extension, targetFolderId)) {
			return toast.error('An item with this name already exists in this folder');
		}

		const { error } = await supabase.from('files').insert([
			{
				name: pendingImport.name,
				extension: pendingImport.extension,
				content: pendingImport.content,
				is_folder: false,
				parent_id: targetFolderId,
				sort_order: files.length,
				is_open: true,
				user_id: user.id
			}
		]);
		if (error) toast.error('Import failed');
		else {
			toast.success('Imported');
			closeModals();
			fetchFiles();
		}
	}

	function handleFileDrop(e: DragEvent) {
		e.preventDefault();
		const file = e.dataTransfer?.files?.[0];
		if (file) processFile(file);
	}

	function getFileInfo(item: any) {
		if (!item || item.is_folder) return null;
		const content = item.content || '';
		const ext = item.extension;
		const isMedia = isImage(ext) || isVideo(ext);

		const size = isMedia ? Math.round((content.length * 3) / 4) : new Blob([content]).size;

		const lines = isMedia ? 0 : content === '' ? 0 : content.split('\n').length;
		const chars = isMedia ? 0 : content.length;
		const date = new Date(item.updated_at).toLocaleString();

		return { sizeStr: formatSize(size), lines, chars, date, isMedia };
	}

	onMount(() => {
		(async () => {
			const {
				data: { session }
			} = await supabase.auth.getSession();
			user = session?.user ?? null;
			if (user) fetchFiles();
		})();

		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((_event, session) => {
			user = session?.user ?? null;
			if (user) fetchFiles();
		});

		document.documentElement.classList.toggle('dark', isDarkMode);
		window.addEventListener('resize', checkScroll);

		return () => {
			subscription.unsubscribe();
			window.removeEventListener('resize', checkScroll);
		};
	});
	const gridClasses: Record<LayoutMode, string> = {
		'1': 'grid-cols-1',
		V2: 'grid-cols-2',
		H2: 'grid-rows-2',
		V3: 'grid-cols-3',
		Grid4: 'grid-cols-2 grid-rows-2',
		Grid6: 'grid-cols-3 grid-rows-2'
	};
	const getViewCount = (m: LayoutMode) => ({ '1': 1, V2: 2, H2: 2, V3: 3, Grid4: 4, Grid6: 6 })[m];
</script>

<Toaster />

{#if !user}
	<div class="flex h-screen w-full flex-col items-center justify-center bg-(--bg-main) p-4">
		<div
			class="w-full max-w-sm rounded-4xl border border-(--border-color) bg-(--bg-modal) p-12 text-center shadow-2xl"
		>
			<h1 class="mb-8 text-3xl font-black tracking-tighter">PowerNote</h1>
			<p class="mb-10 text-sm opacity-50">Please sign in to manage your notes.</p>
			<button
				onclick={login}
				class="btn-primary flex w-full items-center justify-center gap-3 py-4"
			>
				<svg class="h-5 w-5" viewBox="0 0 24 24">
					<path
						fill="currentColor"
						d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
					/>
					<path
						fill="currentColor"
						d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
					/>
					<path
						fill="currentColor"
						d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
					/>
					<path
						fill="currentColor"
						d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.17-4.53z"
					/>
				</svg>
				Sign in with Google
			</button>
		</div>
	</div>
{:else}
	<div class="flex h-screen w-full overflow-hidden bg-(--bg-main) p-2 font-sans md:p-4">
		{#if isSidebarOpen}
			<div
				transition:slide={{ axis: 'x', duration: 300 }}
				class="absolute inset-y-2 left-2 z-50 h-[calc(100%-1rem)] md:relative md:inset-0 md:h-full"
			>
				<Sidebar
					{files}
					onSelect={(file) => {
						handleSelect(file);
						// モバイル時はファイル選択後にサイドバーを自動で閉じる
						if (window.innerWidth < 768) isSidebarOpen = false;
					}}
					onOpenModal={(t) => (showModal = t)}
					onOpenSettings={() => {
						activeView = 'settings';
						if (window.innerWidth < 768) isSidebarOpen = false;
					}}
					onOpenActions={openItemActions}
					selectedId={activeTabId}
					{activeView}
				/>
			</div>

			<button
				onclick={() => (isSidebarOpen = false)}
				class="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
				aria-label="Close sidebar"
			></button>
		{/if}

		<main
			class="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-(--border-color) bg-(--bg-sidebar) shadow-sm transition-[margin] duration-300"
			class:md:ml-4={isSidebarOpen}
		>
			<header
				class="flex h-16 shrink-0 items-center gap-2 border-b border-(--border-color)/30 bg-(--bg-sidebar) px-4"
			>
				<button
					onclick={() => (isSidebarOpen = !isSidebarOpen)}
					aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5"
				>
					<svg
						class="h-5 w-5 opacity-40"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
					>
						<path d="M4 6h16M4 12h16M4 18h7" />
					</svg>
				</button>

				{#if activeView === 'editor'}
					<TabManager
						{tabs}
						{activeTabId}
						{draggingTabId}
						{canScrollLeft}
						{canScrollRight}
						bind:scrollContainer
						onSelect={handleSelect}
						onClose={closeTab}
						onDragStart={handleDragStart}
						onDragOver={handleDragOver}
						onDragEnd={handleDragEnd}
						onScroll={checkScroll}
						onWheel={handleWheel}
						{scrollTabs}
					/>
				{:else}
					<div class="flex h-full items-center px-2">
						<div
							class="flex h-9 items-center rounded-full bg-(--accent-color)/10 px-4 ring-1 ring-(--accent-color)/20"
						>
							<span class="text-[12px] font-bold text-(--accent-color)">Settings</span>
						</div>
					</div>
				{/if}
			</header>

			<div class="relative flex-1 overflow-hidden">
				{#if activeView === 'settings'}
					<div class="h-full overflow-y-auto scroll-smooth px-4">
						<div class="mx-auto max-w-2xl px-8 py-16">
							<h2 class="mb-12 text-4xl font-black tracking-tighter">Settings</h2>

							<section class="mb-10">
								<h3 class="text-label mb-6">Account</h3>
								<div
									class="flex items-center justify-between rounded-3xl border border-(--border-color)/50 bg-(--bg-main) p-8"
								>
									<div>
										<p class="text-sm font-bold">{user?.email}</p>
										<p class="mt-1 text-xs opacity-50">Signed in with Google</p>
									</div>
									<button
										onclick={logout}
										class="btn-ghost px-6 py-2.5 text-red-500 hover:bg-red-500/10"
									>
										Sign Out
									</button>
								</div>
							</section>

							<section>
								<h3 class="text-label mb-6">Appearance</h3>
								<div
									class="flex items-center justify-between rounded-3xl border border-(--border-color)/50 bg-(--bg-main) p-8"
								>
									<div>
										<p class="text-sm font-bold">Dark Mode</p>
										<p class="mt-1 text-xs opacity-50">High contrast dark theme</p>
									</div>
									<button onclick={toggleTheme} class="btn-primary px-8 py-2.5">
										{isDarkMode ? 'Dark' : 'Light'}
									</button>
								</div>
							</section>
							<section class="mt-10">
								<h3 class="text-label mb-6">Usage</h3>
								<div class="rounded-3xl border border-(--border-color)/50 bg-(--bg-main) p-8">
									<div class="flex justify-between text-sm">
										<span class="opacity-50">Storage Usage</span>
										<span class="font-bold">{formatSize(totalSize)} / 500 MB</span>
									</div>
									<div
										class="mt-4 h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/5"
									>
										<div
											class="h-full bg-(--accent-color) transition-all"
											style="width: {(totalSize / MAX_TOTAL_SIZE) * 100}%"
										></div>
									</div>
									<p class="mt-4 text-[11px] opacity-40">
										Max 50MB per file. Database limit: 500MB total.
									</p>
								</div>
							</section>
						</div>
					</div>
				{:else}
					<div class="grid h-full w-full divide-(--border-color)/30 {gridClasses[layoutMode]}">
						{#each Array(getViewCount(layoutMode)) as _, i}
							{@const viewId = viewStates[i]}
							{@const viewFile = files.find((f) => f.id === viewId)}
							<div
								role="presentation"
								onclick={() => (activeViewIndex = i)}
								class="group/pane relative flex flex-col border border-(--border-color)/10 transition-colors {activeViewIndex ===
								i
									? 'bg-(--accent-color)/2 ring-2 ring-(--accent-color)/20 ring-inset'
									: ''}"
							>
								{#if viewFile}
									<div
										class="absolute top-6 right-6 z-20 opacity-0 transition-opacity group-hover/pane:opacity-100"
									>
										<button
											onclick={() => openItemActions(viewFile)}
											aria-label="Open file actions"
											class="flex h-8 w-8 items-center justify-center rounded-full border border-(--border-color)/50 bg-(--bg-sidebar)/80 shadow-lg backdrop-blur-md hover:scale-110"
										>
											<svg
												class="h-4 w-4 opacity-60"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2.5"
											>
												<circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle
													cx="12"
													cy="19"
													r="1"
												/>
											</svg>
										</button>
									</div>

									{#if isImage(viewFile.extension)}
										<div class="flex h-full w-full items-center justify-center p-8">
											<img
												src={viewFile.content}
												alt={viewFile.name}
												class="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
											/>
										</div>
									{:else if isVideo(viewFile.extension)}
										<div class="flex h-full w-full items-center justify-center p-8">
											<video
												controls
												muted
												src={viewFile.content}
												class="max-h-full max-w-full rounded-xl shadow-2xl"
											>
												<track kind="captions" />
											</video>
										</div>
									{:else}
										<textarea
											bind:value={viewFile.content}
											class="h-full w-full resize-none overflow-y-auto border-none bg-transparent p-5 font-mono text-[15px] leading-relaxed outline-none focus:ring-0"
											spellcheck="false"
											placeholder="Start writing..."
										></textarea>
									{/if}
								{:else}
									<div
										class="m-4 flex h-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-(--border-color)/10"
									>
										<span class="text-[9px] font-black tracking-widest uppercase opacity-20"
											>View {i + 1}: Select file</span
										>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			{#if activeView === 'editor'}
				<div
					class="absolute right-6 bottom-6 z-40 flex items-center gap-1 rounded-2xl border border-(--border-color)/50 bg-(--bg-modal)/80 p-1.5 shadow-2xl backdrop-blur-xl"
				>
					{#each ['1', 'V2', 'H2', 'V3', 'Grid4', 'Grid6'] as mode}
						<button
							onclick={() => {
								layoutMode = mode as LayoutMode;
								const count = getViewCount(layoutMode);
								while (viewStates.length < count) viewStates.push('');
								if (activeViewIndex >= count) activeViewIndex = 0;
							}}
							class="rounded-xl px-3 py-1.5 text-[10px] font-black transition-all {layoutMode ===
							mode
								? 'bg-(--accent-color) text-white shadow-(--accent-color)/20 shadow-lg'
								: 'opacity-40 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/5'}"
						>
							{mode}
						</button>
					{/each}
				</div>
			{/if}
		</main>
	</div>
{/if}

{#if showModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			type="button"
			aria-label="Close modal"
			class="absolute inset-0 cursor-default bg-slate-900/40 backdrop-blur-sm"
			onclick={closeModals}
		></button>
		<div
			class="relative w-full max-w-md rounded-4xl border border-(--border-color) bg-(--bg-modal) p-10 shadow-2xl"
		>
			{#if showModal === 'create'}
				<h3 class="modal-title mb-8">Create New Item</h3>
				<div class="space-y-6">
					<div class="flex gap-1 rounded-2xl bg-(--bg-input) p-1">
						<button
							type="button"
							onclick={() => (createType = 'file')}
							class="flex-1 rounded-xl py-2 text-xs font-bold transition-all {createType === 'file'
								? 'bg-(--bg-sidebar) shadow-sm'
								: 'opacity-40'}">File</button
						>
						<button
							type="button"
							onclick={() => (createType = 'folder')}
							class="flex-1 rounded-xl py-2 text-xs font-bold transition-all {createType ===
							'folder'
								? 'bg-(--bg-sidebar) shadow-sm'
								: 'opacity-40'}">Folder</button
						>
					</div>
					<input bind:value={newName} class="input-base w-full" placeholder="Enter name..." />
					<Select
						label="Target Location"
						value={targetFolderId}
						options={folderOptions}
						onSelect={(id) => (targetFolderId = id)}
					/>
				</div>
				<div class="mt-10 flex gap-3">
					<button type="button" onclick={closeModals} class="btn-ghost flex-1">Cancel</button>
					<button type="button" onclick={handleCreate} class="btn-primary flex-1">Create</button>
				</div>
			{:else if showModal === 'import'}
				<h3 class="modal-title mb-8">Import File</h3>
				<div class="space-y-6">
					{#if !pendingImport}
						<div
							role="button"
							tabindex="0"
							ondragover={(e) => e.preventDefault()}
							ondrop={handleFileDrop}
							onclick={() => document.getElementById('file-upload')?.click()}
							onkeydown={(e) =>
								(e.key === 'Enter' || e.key === ' ') &&
								document.getElementById('file-upload')?.click()}
							class="flex aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-(--border-color)/40 bg-(--bg-input)/30 transition-colors hover:bg-(--bg-input)/50"
						>
							<input
								id="file-upload"
								type="file"
								accept="image/*,video/*,text/*,.txt,.md,.json,.js,.ts"
								class="hidden"
								onchange={(e) => {
									const file = (e.target as HTMLInputElement).files?.[0];
									if (file) processFile(file);
								}}
							/>
							<svg
								class="mb-3 h-8 w-8 opacity-20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline
									points="17 8 12 3 7 8"
								/><line x1="12" y1="3" x2="12" y2="15" />
							</svg>
							<span class="px-4 text-center text-xs font-bold text-balance opacity-40"
								>Text, Image, or Video (Max 50MB)</span
							>
						</div>
					{:else}
						<div class="rounded-2xl bg-(--bg-input) p-6">
							<p class="text-[10px] font-bold tracking-widest uppercase opacity-40">
								Selected File
							</p>
							<p class="mt-2 truncate font-mono text-sm">
								{pendingImport.name}.{pendingImport.extension}
							</p>
							<p class="mt-1 text-[10px] opacity-40">
								Size: {formatSize(pendingImport.size)}
							</p>
						</div>
					{/if}
					<Select
						label="Import to Folder"
						value={targetFolderId}
						options={folderOptions}
						onSelect={(id) => (targetFolderId = id)}
					/>
				</div>
				<div class="mt-10 flex gap-3">
					<button type="button" onclick={closeModals} class="btn-ghost flex-1">Cancel</button>
					<button
						type="button"
						disabled={!pendingImport}
						onclick={confirmImport}
						class="btn-primary flex-1 disabled:opacity-20">Import Now</button
					>
				</div>
			{:else if showModal === 'actions'}
				<div class="mb-8">
					<h3 class="modal-title mb-2 truncate">
						{targetItem?.name}{targetItem?.is_folder ? '' : `.${targetItem?.extension}`}
					</h3>
					{#if !targetItem?.is_folder}
						{@const info = getFileInfo(targetItem)}
						{#if info}
							<div class="grid grid-cols-2 gap-y-2 rounded-2xl bg-black/5 p-4 dark:bg-white/5">
								<div class="text-[10px] font-bold uppercase opacity-40">Size</div>
								<div class="font-mono text-[11px]">{info.sizeStr}</div>
								<div class="text-[10px] font-bold uppercase opacity-40">Updated</div>
								<div class="font-mono text-[11px]">{info.date}</div>
								{#if !info.isMedia}
									<div class="text-[10px] font-bold uppercase opacity-40">Chars</div>
									<div class="font-mono text-[11px]">{info.chars}</div>
									<div class="text-[10px] font-bold uppercase opacity-40">Lines</div>
									<div class="font-mono text-[11px]">{info.lines}</div>
								{/if}
							</div>
						{/if}
					{/if}
				</div>
				{#if !targetItem?.is_folder}
					<div class="space-y-2">
						<span class="text-label">Tags</span>
						<div class="mb-3 flex flex-wrap gap-2">
							{#each targetItem.tags || [] as tag, i}
								<div
									class="flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11px] font-bold"
									style="background-color: {tag.color}15; border-color: {tag.color}40; color: {tag.color};"
								>
									<span class="max-w-25 truncate">{tag.name}</span>
									<button
										type="button"
										title="Edit Tag"
										onclick={(e) => {
											e.stopPropagation();
											editingTag = { ...tag };
											showTagEditModal = true;
										}}
										class="flex h-6 w-6 items-center justify-center rounded-lg bg-black/5 dark:bg-white/10"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="14"
											height="14"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2.5"
											stroke-linecap="round"
											stroke-linejoin="round"
											><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle
												cx="12"
												cy="19"
												r="1"
											/></svg
										>
									</button>
								</div>
							{/each}
						</div>

						<div class="relative">
							<input
								bind:value={newTagName}
								onkeydown={addTag}
								onfocus={() => (isTagInputFocused = true)}
								onblur={() => setTimeout(() => (isTagInputFocused = false), 200)}
								class="input-base w-full"
								placeholder="Add tag and press Enter..."
							/>

							{#if isTagInputFocused}
								<div
									transition:slide={{ duration: 150 }}
									class="absolute top-full right-0 left-0 z-10 mt-2 flex flex-wrap gap-1.5 rounded-2xl border border-(--border-color) bg-(--bg-modal) p-3 shadow-xl"
								>
									<p class="mb-1 w-full text-[9px] font-black uppercase opacity-30">Suggestions</p>
									{#each tagSuggestions() as suggestion}
										<button
											type="button"
											onclick={() => addSuggestedTag(suggestion)}
											class="rounded-lg bg-black/5 px-2.5 py-1 text-[11px] font-bold transition-colors hover:bg-(--accent-color) hover:text-white dark:bg-white/5"
										>
											{suggestion}
										</button>
									{/each}
								</div>
							{/if}
						</div>
						<div class="mb-6"></div>
					</div>
				{/if}
				<div class="grid grid-cols-1 gap-2">
					{#if !targetItem?.is_folder}
						<button
							type="button"
							onclick={saveToDevice}
							class="flex w-full items-center gap-3 rounded-2xl bg-black/5 p-4 text-sm font-bold transition-all hover:bg-(--accent-color)/10 dark:bg-white/5"
							>Save to Device...</button
						>
						<button
							type="button"
							onclick={togglePin}
							class="flex w-full items-center gap-3 rounded-2xl bg-black/5 p-4 text-sm font-bold transition-all hover:bg-(--accent-color)/10 dark:bg-white/5"
							>{targetItem?.is_pinned ? 'Unpin' : 'Pin'} Tab</button
						>
					{/if}
					<button
						type="button"
						onclick={() => (showModal = 'rename')}
						class="flex w-full items-center gap-3 rounded-2xl bg-black/5 p-4 text-sm font-bold transition-all hover:bg-(--accent-color)/10 dark:bg-white/5"
						>Edit Info / Move</button
					>
					<button
						type="button"
						onclick={() => (showModal = 'delete-confirm')}
						class="flex w-full items-center gap-3 rounded-2xl bg-red-500/10 p-4 text-sm font-bold text-red-500 transition-all hover:bg-red-500 hover:text-white"
						>Delete</button
					>
				</div>
				<button type="button" onclick={closeModals} class="btn-ghost mt-6 w-full">Cancel</button>
			{:else if showModal === 'rename'}
				<h3 class="modal-title mb-8">Edit Details</h3>
				<div class="space-y-6">
					<input bind:value={newName} class="input-base w-full" placeholder="Enter name..." />
					<Select
						label="Move to"
						value={targetFolderId}
						options={folderOptions}
						onSelect={(id) => (targetFolderId = id)}
					/>
				</div>
				<div class="mt-10 flex gap-3">
					<button type="button" onclick={() => (showModal = 'actions')} class="btn-ghost flex-1"
						>Back</button
					>
					<button type="button" onclick={updateItem} class="btn-primary flex-1">Save</button>
				</div>
			{:else if showModal === 'delete-confirm'}
				<h3 class="modal-title mb-4 text-red-500">Delete Item?</h3>
				<p class="mb-8 text-sm opacity-60">
					Are you sure you want to delete <strong>{targetItem?.name}</strong>?
				</p>
				<div class="flex flex-col gap-3">
					<button
						type="button"
						onclick={deleteItem}
						class="btn-primary bg-red-500 py-4 hover:bg-red-600">Delete Permanently</button
					>
					<button type="button" onclick={() => (showModal = 'actions')} class="btn-ghost"
						>Cancel</button
					>
				</div>
			{/if}
		</div>
	</div>
{/if}
{#if showTagEditModal && editingTag}
	<div
		onclick={() => (showTagEditModal = false)}
		role="presentation"
		class="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
	>
		<div
			onclick={(e) => e.stopPropagation()}
			role="presentation"
			class="w-full max-w-xs rounded-4xl border border-(--border-color) bg-(--bg-modal) p-7 shadow-2xl"
		>
			<h4 class="mb-6 text-[10px] font-black tracking-widest uppercase opacity-40">Manage Tag</h4>

			<div class="space-y-6">
				<div class="space-y-1.5">
					<label for="edit-tag-name" class="ml-1 text-[10px] font-bold uppercase opacity-40"
						>Tag Name</label
					>
					<input id="edit-tag-name" bind:value={editingTag.name} class="input-base w-full py-3" />
				</div>

				<div class="space-y-2" role="group" aria-labelledby="color-select-label">
					<span
						id="color-select-label"
						class="ml-1 block text-[10px] font-bold uppercase opacity-40">Select Color</span
					>
					<div class="grid grid-cols-5 gap-3 p-1">
						{#each tagPresets as color}
							<button
								type="button"
								onclick={(e) => {
									editingTag!.color = color;
									(e.currentTarget as HTMLButtonElement).blur();
								}}
								class="relative flex h-8 w-8 items-center justify-center rounded-full transition-all outline-none {editingTag.color ===
								color
									? 'scale-110 ring-2 ring-(--accent-color) ring-offset-2 dark:ring-offset-gray-900'
									: 'opacity-70 hover:scale-105 hover:opacity-100'}"
								style="background-color: {color};"
								title={color}
								aria-label="Select color {color}"
								aria-pressed={editingTag.color === color}
							>
								{#if editingTag.color === color}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="white"
										stroke-width="4"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<polyline points="20 6 9 17 4 12" />
									</svg>
								{/if}
							</button>
						{/each}
					</div>
				</div>

				<div class="space-y-3 pt-2">
					<button onclick={updateTagDetail} class="btn-primary w-full py-4 text-sm">
						Save Changes
					</button>

					<button
						onclick={() => {
							removeTag(editingTag!.id);
							showTagEditModal = false;
						}}
						class="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-xs font-bold text-red-500 hover:bg-red-500/10"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path
								d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
							/></svg
						>
						Remove from File
					</button>

					<button onclick={() => (showTagEditModal = false)} class="btn-ghost w-full py-3 text-xs">
						Cancel
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
