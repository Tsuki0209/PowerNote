<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { onMount } from 'svelte';
	import toast, { Toaster } from 'svelte-french-toast';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Select from '$lib/components/Select.svelte';

	let files = $state<any[]>([]);
	let selectedFile = $state<any>(null);
	let isSidebarOpen = $state(true);
	let showModal = $state<'create' | 'import' | null>(null);

	let activeView = $state<'editor' | 'settings'>('editor');
	let isDarkMode = $state(true);

	let createType = $state<'file' | 'folder'>('file');
	let newName = $state('');
	let targetFolderId = $state<string | null>(null);

	let folders = $derived(files.filter((f) => f.is_folder));
	let folderOptions = $derived([
		{ id: null, name: '/ Root' },
		...folders.map((f) => ({ id: f.id, name: f.name }))
	]);

	async function fetchFiles() {
		const { data } = await supabase.from('files').select('*').order('name', { ascending: true });
		files = data || [];
	}

	function handleSelect(file: any) {
		activeView = 'editor';
		selectedFile = file;
	}

	function openSettings() {
		activeView = 'settings';
		selectedFile = null;
	}

	function toggleTheme() {
		isDarkMode = !isDarkMode;
		if (isDarkMode) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}

	function closeModals() {
		showModal = null;
		newName = '';
		targetFolderId = null;
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
				content: ''
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
			await supabase
				.from('files')
				.insert([{ name, extension: ext, content, is_folder: false, parent_id: targetFolderId }]);
			closeModals();
			fetchFiles();
		};
		reader.readAsText(file);
	}

	onMount(() => {
		fetchFiles();
		if (isDarkMode) document.documentElement.classList.add('dark');
	});
</script>

<Toaster />

<div class="flex h-screen w-full gap-2 overflow-hidden bg-(--bg-main) p-2 md:gap-4 md:p-4">
	{#if isSidebarOpen}
		<Sidebar
			{files}
			onSelect={handleSelect}
			onOpenModal={(t) => (showModal = t)}
			onOpenSettings={openSettings}
			selectedId={selectedFile?.id}
			{activeView}
		/>
	{/if}

	<main
		class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-(--border-color) bg-(--bg-sidebar) shadow-sm"
	>
		<header class="flex h-14 shrink-0 items-center border-b border-(--border-color)/50 px-8">
			<button
				onclick={() => (isSidebarOpen = !isSidebarOpen)}
				class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
				aria-label="Toggle Menu"
			>
				<svg
					class="h-5 w-5 opacity-50"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"><path d="M4 6h16M4 12h16M4 18h7" /></svg
				>
			</button>

			<div class="ml-6 flex items-center gap-2 text-[13px] font-semibold tracking-tight">
				<span class="text-[10px] uppercase opacity-20">Library</span>
				<span class="opacity-20">/</span>
				<span class="opacity-90">
					{activeView === 'settings'
						? 'Settings'
						: selectedFile
							? selectedFile.name + (selectedFile.is_folder ? '' : '.' + selectedFile.extension)
							: 'Home'}
				</span>
			</div>
		</header>

		<div class="flex-1 overflow-hidden">
			{#if activeView === 'settings'}
				<div class="h-full overflow-y-auto px-4">
					<div class="mx-auto max-w-2xl px-8 py-12">
						<h2 class="mb-10 text-3xl font-black tracking-tight">Settings</h2>
						<div class="space-y-10">
							<section>
								<h3 class="text-label mb-6">Appearance</h3>
								<div
									class="flex items-center justify-between rounded-2xl border border-(--border-color)/50 bg-(--bg-main) p-6"
								>
									<div>
										<p class="text-sm font-bold">Dark Mode</p>
										<p class="text-xs opacity-50">Switch between light and dark themes</p>
									</div>
									<button onclick={toggleTheme} class="btn-primary px-6 py-2">
										{isDarkMode ? 'Dark' : 'Light'}
									</button>
								</div>
							</section>
							<section>
								<h3 class="text-label mb-4 px-1">About</h3>
								<div class="px-1 text-[13px] leading-relaxed font-medium opacity-50">
									PowerNote v1.0.0<br />
									Minimalist Cloud Editor for Synthetix.
								</div>
							</section>
						</div>
					</div>
				</div>
			{:else if selectedFile && !selectedFile.is_folder}
				<textarea
					bind:value={selectedFile.content}
					class="h-full w-full resize-none overflow-y-auto border-none bg-transparent p-10 font-mono text-[16px] leading-relaxed ring-0 outline-none focus:ring-0"
					spellcheck="false"
					placeholder="Start typing..."
				></textarea>
			{:else}
				<div class="flex h-full flex-col items-center justify-center opacity-20">
					<svg
						class="mb-4 h-16 w-16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1"
						><path
							d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
						/></svg
					>
					<span class="text-[10px] font-black tracking-[0.4em] uppercase">No active item</span>
				</div>
			{/if}
		</div>
	</main>
</div>

{#if showModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-md">
		<div class="w-96 rounded-[28px] border border-(--border-color) bg-(--bg-modal) p-10 shadow-2xl">
			<h3 class="modal-title mb-8">
				{showModal === 'create' ? 'Create New Item' : 'Import File'}
			</h3>
			<div class="space-y-6">
				{#if showModal === 'create'}
					<div class="flex gap-1 rounded-xl bg-(--bg-input) p-1">
						<button
							type="button"
							onclick={() => (createType = 'file')}
							class="flex-1 rounded-lg py-2 text-xs font-bold transition-all {createType === 'file'
								? 'bg-(--bg-sidebar) shadow-sm'
								: 'opacity-40'}">File</button
						>
						<button
							type="button"
							onclick={() => (createType = 'folder')}
							class="flex-1 rounded-lg py-2 text-xs font-bold transition-all {createType ===
							'folder'
								? 'bg-(--bg-sidebar) shadow-sm'
								: 'opacity-40'}">Folder</button
						>
					</div>
					<input
						bind:value={newName}
						class="input-base w-full outline-none"
						placeholder="Enter name..."
					/>
				{:else}
					<div
						class="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-(--border-color) p-8 transition-colors hover:border-(--accent-color)/50"
					>
						<input
							type="file"
							onchange={handleImport}
							class="w-full text-xs opacity-50 file:hidden"
						/>
						<span class="mt-2 text-[10px] font-bold uppercase opacity-30">Click to upload</span>
					</div>
				{/if}
				<Select
					label="Target Location"
					value={targetFolderId}
					options={folderOptions}
					onSelect={(id) => (targetFolderId = id)}
				/>
			</div>
			<div class="mt-10 flex gap-3">
				<button type="button" onclick={closeModals} class="btn-ghost flex-1">Cancel</button>
				{#if showModal === 'create'}
					<button type="button" onclick={handleCreate} class="btn-primary flex-1">Create</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
