<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { onMount } from 'svelte';
	import toast, { Toaster } from 'svelte-french-toast';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Select from '$lib/components/Select.svelte';

	let files = $state<any[]>([]);
	let isSidebarOpen = $state(true);
	let showModal = $state<'create' | 'import' | 'actions' | 'rename' | 'delete-confirm' | null>(
		null
	);

	// タブ管理：DB上の is_open が true のものを tabs として扱う
	let tabs = $derived(
		files
			.filter((f) => f.is_open)
			.sort((a, b) => {
				// 1. ピン留めを優先
				if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
				// 2. 次に sort_order 順
				return a.sort_order - b.sort_order;
			})
	);

	let activeTabId = $state<string | null>(null);
	let selectedFile = $derived(files.find((f) => f.id === activeTabId) || null);

	// ドラッグ中のタブIDを保持
	let draggingTabId = $state<string | null>(null);

	// 操作対象のアイテム
	let targetItem = $state<any>(null);

	let activeView = $state<'editor' | 'settings'>('editor');
	let isDarkMode = $state(true);

	let createType = $state<'file' | 'folder'>('file');
	let newName = $state('');
	let targetFolderId = $state<string | null>(null);

	// タブスクロール制御
	let scrollContainer = $state<HTMLDivElement | null>(null);
	let canScrollLeft = $state(false);
	let canScrollRight = $state(false);

	let folders = $derived(files.filter((f) => f.is_folder));
	let folderOptions = $derived([
		{ id: null, name: '/ Root' },
		...folders.map((f) => ({ id: f.id, name: f.name }))
	]);

	async function fetchFiles() {
		const { data } = await supabase
			.from('files')
			.select('*')
			.order('sort_order', { ascending: true });
		files = data || [];
	}

	async function handleSelect(file: any) {
		if (file.is_folder) return;
		activeView = 'editor';
		activeTabId = file.id;

		// タブが開いていない場合はDBを更新
		if (!file.is_open) {
			const { error } = await supabase.from('files').update({ is_open: true }).eq('id', file.id);

			if (!error) {
				// ローカル状態を即時更新
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

		// DBのis_openをfalseに更新
		const { error } = await supabase.from('files').update({ is_open: false }).eq('id', id);

		if (!error) {
			const closedTabIndex = tabs.findIndex((t) => t.id === id);

			// ローカル状態を更新
			const f = files.find((item) => item.id === id);
			if (f) f.is_open = false;

			if (activeTabId === id) {
				if (tabs.length > 0) {
					// 閉じたタブの前のタブを選択
					activeTabId = tabs[Math.max(0, closedTabIndex - 1)].id;
				} else {
					activeTabId = null;
				}
			}
		}
		setTimeout(checkScroll, 50);
	}

	// --- ドラッグ&ドロップ ロジック ---
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

		// sort_orderをローカルで再計算
		files = newFiles.map((f, i) => ({ ...f, sort_order: i }));
	}

	async function handleDragEnd() {
		draggingTabId = null;
		// 並び順をDBに同期
		const promises = files.map((f) =>
			supabase.from('files').update({ sort_order: f.sort_order }).eq('id', f.id)
		);

		const results = await Promise.all(promises);
		if (results.some((r) => r.error)) {
			toast.error('Failed to sync order');
		} else {
			await fetchFiles();
		}
	}

	async function saveFile() {
		if (!targetItem || targetItem.is_folder) return;
		const { error } = await supabase
			.from('files')
			.update({ content: targetItem.content })
			.eq('id', targetItem.id);
		if (error) toast.error('Failed to save');
		else {
			toast.success('Saved successfully');
			showModal = null;
		}
	}

	function downloadFile() {
		if (!targetItem || targetItem.is_folder) return;
		const blob = new Blob([targetItem.content], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${targetItem.name}.${targetItem.extension || 'txt'}`;
		a.click();
		URL.revokeObjectURL(url);
		showModal = null;
	}

	async function updateItem() {
		if (!targetItem || !newName) return;
		if (targetItem.is_folder && targetFolderId === targetItem.id) {
			return toast.error('Cannot move a folder into itself');
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
			if (activeTabId === idToDelete) activeTabId = null;
			await fetchFiles();
			closeModals();
			toast.success('Deleted');
		}
	}

	async function togglePin() {
		if (!targetItem || targetItem.is_folder) return;
		const newPinned = !targetItem.is_pinned;

		const { error } = await supabase
			.from('files')
			.update({ is_pinned: newPinned })
			.eq('id', targetItem.id);

		if (error) {
			toast.error('Failed to update pin');
		} else {
			await fetchFiles();
			toast.success(newPinned ? 'Pinned' : 'Unpinned');
		}
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
		const amount = 240;
		scrollContainer.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
	}

	function handleWheel(e: WheelEvent) {
		if (!scrollContainer) return;
		if (e.deltaY !== 0) {
			e.preventDefault();
			scrollContainer.scrollLeft += e.deltaY;
			checkScroll();
		}
	}

	function openSettings() {
		activeView = 'settings';
		activeTabId = null;
	}

	function toggleTheme() {
		isDarkMode = !isDarkMode;
		if (isDarkMode) document.documentElement.classList.add('dark');
		else document.documentElement.classList.remove('dark');
	}

	function closeModals() {
		showModal = null;
		newName = '';
		targetFolderId = null;
		targetItem = null;
	}

	async function handleCreate() {
		if (!newName) return toast.error('Name required');
		const isFolder = createType === 'folder';
		const { error } = await supabase.from('files').insert([
			{
				name: newName,
				extension: isFolder ? null : 'txt',
				is_folder: isFolder,
				parent_id: targetFolderId,
				content: '',
				sort_order: files.length,
				is_open: !isFolder // 新規ファイル作成時に自動でタブを開く
			}
		]);
		if (error) toast.error('Error creating item');
		else {
			closeModals();
			await fetchFiles();
		}
	}

	async function handleImport(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files?.[0]) return;
		const file = input.files[0];
		const reader = new FileReader();
		reader.onload = async (e) => {
			const content = e.target?.result as string;
			const name = file.name.split('.').slice(0, -1).join('.') || file.name;
			const ext = file.name.split('.').pop() || 'txt';
			await supabase.from('files').insert([
				{
					name,
					extension: ext,
					content,
					is_folder: false,
					parent_id: targetFolderId,
					sort_order: files.length,
					is_open: true
				}
			]);
			closeModals();
			fetchFiles();
		};
		reader.readAsText(file);
	}

	onMount(() => {
		fetchFiles();
		if (isDarkMode) document.documentElement.classList.add('dark');
		window.addEventListener('resize', checkScroll);
		return () => window.removeEventListener('resize', checkScroll);
	});
</script>

<Toaster />

<div
	class="flex h-screen w-full gap-2 overflow-hidden bg-(--bg-main) p-2 font-sans md:gap-4 md:p-4"
>
	{#if isSidebarOpen}
		<Sidebar
			{files}
			onSelect={handleSelect}
			onOpenModal={(t) => (showModal = t)}
			onOpenSettings={openSettings}
			onOpenActions={openItemActions}
			selectedId={activeTabId}
			{activeView}
		/>
	{/if}

	<main
		class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-(--border-color) bg-(--bg-sidebar) shadow-sm"
	>
		<header
			class="flex h-16 shrink-0 items-center gap-2 border-b border-(--border-color)/30 bg-(--bg-sidebar) px-4"
		>
			<button
				onclick={() => (isSidebarOpen = !isSidebarOpen)}
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5"
				aria-label="Toggle Sidebar"
			>
				<svg
					class="h-5 w-5 opacity-40"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"><path d="M4 6h16M4 12h16M4 18h7" /></svg
				>
			</button>

			<div class="group/header relative h-full flex-1 overflow-hidden">
				{#if activeView === 'editor'}
					{#if canScrollLeft}
						<div
							class="absolute left-0 z-10 flex h-full items-center bg-linear-to-r from-(--bg-sidebar) via-(--bg-sidebar) to-transparent pr-12"
						>
							<button
								onclick={() => scrollTabs('left')}
								aria-label="Scroll tabs left"
								class="ml-1 flex h-7 w-7 items-center justify-center rounded-full border border-(--border-color)/50 bg-(--bg-sidebar) shadow-sm transition-transform hover:scale-110"
							>
								<svg
									class="h-4 w-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="3"><path d="M15 18l-6-6 6-6" /></svg
								>
							</button>
						</div>
					{/if}

					<div
						bind:this={scrollContainer}
						onscroll={checkScroll}
						onwheel={handleWheel}
						role="list"
						aria-label="Open tabs"
						class="scrollbar-none flex h-full items-center gap-2 overflow-x-auto scroll-smooth px-4"
					>
						{#each tabs as tab (tab.id)}
							<div
								draggable="true"
								role="listitem"
								ondragstart={() => handleDragStart(tab.id)}
								ondragover={(e) => handleDragOver(e, tab.id)}
								ondragend={handleDragEnd}
								class="group relative flex h-9 w-40 shrink-0 cursor-grab items-center overflow-hidden rounded-full transition-all active:cursor-grabbing
                                {activeTabId === tab.id
									? 'bg-(--accent-color)/10 ring-1 ring-(--accent-color)/30'
									: 'bg-(--bg-main)/50 hover:bg-black/5 dark:hover:bg-white/5'}
                                {draggingTabId === tab.id ? 'opacity-40' : 'opacity-100'}"
								title="{tab.name}.{tab.extension}"
							>
								<button
									onclick={() => (activeTabId = tab.id)}
									class="flex h-full min-w-0 flex-1 items-center gap-2 pr-2 pl-4 text-[12px] font-bold transition-colors"
								>
									<svg
										class="h-3.5 w-3.5 shrink-0 opacity-40"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
										<path d="M13 2v7h7" />
									</svg>

									<span
										class="pointer-events-none truncate {activeTabId === tab.id
											? 'text-(--accent-color)'
											: 'text-(--text-muted)'}"
									>
										{tab.name}.{tab.extension}
									</span>
								</button>

								{#if tab.is_pinned}
									<div
										class="absolute right-3 flex items-center justify-center text-(--accent-color)"
									>
										<svg
											class="h-3.5 w-3.5"
											viewBox="0 0 24 24"
											fill="currentColor"
											stroke="currentColor"
											stroke-width="1"
										>
											<path
												d="M9 4v1.2a5 5 0 0 0 1.5 3.5l.5.5v4.4l-2 3v1h8v-1l-2-3V9.2l.5-.5a5 5 0 0 0 1.5-3.5V4H9Z"
											/>
											<path d="M12 17v7" />
										</svg>
									</div>
								{:else}
									<button
										onclick={(e) => closeTab(tab.id, e)}
										aria-label="Close {tab.name} tab"
										class="absolute right-2 rounded-full bg-inherit p-1 text-(--text-muted) opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"
									>
										<svg
											class="h-3 w-3"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="3"><path d="M18 6L6 18M6 6l12 12" /></svg
										>
									</button>
								{/if}
							</div>
						{/each}
						<div class="h-1 w-4 shrink-0"></div>
					</div>

					{#if canScrollRight}
						<div
							class="absolute top-0 right-0 z-10 flex h-full items-center bg-linear-to-l from-(--bg-sidebar) via-(--bg-sidebar) to-transparent pl-12"
						>
							<button
								onclick={() => scrollTabs('right')}
								aria-label="Scroll tabs right"
								class="mr-1 flex h-7 w-7 items-center justify-center rounded-full border border-(--border-color)/50 bg-(--bg-sidebar) shadow-sm transition-transform hover:scale-110"
							>
								<svg
									class="h-4 w-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="3"><path d="M9 18l6-6-6-6" /></svg
								>
							</button>
						</div>
					{/if}
				{:else}
					<div class="flex h-full items-center px-2">
						<div
							class="flex h-9 w-fit items-center rounded-full bg-(--accent-color)/10 px-4 ring-1 ring-(--accent-color)/20"
						>
							<span class="text-[12px] font-bold text-(--accent-color)">Settings</span>
						</div>
					</div>
				{/if}
			</div>
		</header>

		<div class="relative flex-1 overflow-hidden">
			{#if activeView === 'settings'}
				<div class="h-full overflow-y-auto scroll-smooth px-4">
					<div class="mx-auto max-w-2xl px-8 py-16">
						<h2 class="mb-12 text-4xl font-black tracking-tighter">Settings</h2>
						<section>
							<h3 class="text-label mb-6">Appearance</h3>
							<div
								class="flex items-center justify-between rounded-3xl border border-(--border-color)/50 bg-(--bg-main) p-8"
							>
								<div>
									<p class="text-sm font-bold">Dark Mode</p>
									<p class="mt-1 text-xs opacity-50">High contrast dark theme</p>
								</div>
								<button onclick={toggleTheme} class="btn-primary px-8 py-2.5"
									>{isDarkMode ? 'Dark' : 'Light'}</button
								>
							</div>
						</section>
					</div>
				</div>
			{:else if selectedFile}
				<div class="absolute top-8 right-8 z-20">
					<button
						onclick={() => openItemActions(selectedFile)}
						aria-label="Open actions menu"
						class="flex h-10 w-10 items-center justify-center rounded-full border border-(--border-color)/50 bg-(--bg-sidebar)/80 shadow-lg backdrop-blur-md transition-all hover:scale-110 hover:border-(--accent-color)/50 active:scale-95"
					>
						<svg
							class="h-5 w-5 opacity-60"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle
								cx="12"
								cy="19"
								r="1"
							/></svg
						>
					</button>
				</div>
				<textarea
					bind:value={selectedFile.content}
					class="h-full w-full resize-none overflow-y-auto border-none bg-transparent p-12 font-mono text-[16px] leading-relaxed ring-0 outline-none focus:ring-0"
					spellcheck="false"
					placeholder="Start writing..."
				></textarea>
			{:else}
				<div class="flex h-full flex-col items-center justify-center">
					<span class="text-[11px] font-black tracking-[0.5em] uppercase opacity-20"
						>Select a file to begin</span
					>
				</div>
			{/if}
		</div>
	</main>
</div>

{#if showModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			type="button"
			class="absolute inset-0 cursor-default bg-slate-900/40 backdrop-blur-sm"
			onclick={closeModals}
			aria-label="Close modal"
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
			{:else if showModal === 'actions'}
				<h3 class="modal-title mb-6">{targetItem?.is_folder ? 'Folder' : 'File'} Actions</h3>
				<div class="grid grid-cols-1 gap-2">
					{#if !targetItem?.is_folder}
						<button
							type="button"
							onclick={saveFile}
							class="flex w-full items-center gap-3 rounded-2xl bg-black/5 p-4 text-sm font-bold transition-all hover:bg-(--accent-color)/10 dark:bg-white/5"
							>Overwrite Save</button
						>
						<button
							type="button"
							onclick={togglePin}
							class="flex w-full items-center gap-3 rounded-2xl bg-black/5 p-4 text-sm font-bold transition-all hover:bg-(--accent-color)/10 dark:bg-white/5"
						>
							{targetItem?.is_pinned ? 'Unpin' : 'Pin'} Tab
						</button>
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

<style>
	.scrollbar-none::-webkit-scrollbar {
		display: none;
	}
	.scrollbar-none {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
</style>
