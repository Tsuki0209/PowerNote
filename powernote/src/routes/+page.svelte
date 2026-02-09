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

<div class="flex h-screen w-full overflow-hidden">
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

	<main class="flex flex-1 flex-col overflow-hidden bg-(--bg-main)">
		<header class="flex h-12 items-center border-b border-gray-200 px-6 dark:border-[#2b2b2b]">
			<button
				onclick={() => (isSidebarOpen = !isSidebarOpen)}
				class="text-[11px] font-bold uppercase opacity-40 transition-opacity hover:opacity-100"
				>Menu</button
			>

			<div class="ml-6 flex items-center gap-2 font-mono text-[13px] tracking-tight">
				<span class="opacity-20">/</span>
				<span class="font-bold opacity-90 dark:text-white">
					{activeView === 'settings'
						? 'Settings'
						: selectedFile
							? selectedFile.name + (selectedFile.is_folder ? '' : '.' + selectedFile.extension)
							: 'Home'}
				</span>
			</div>
		</header>

		<div class="flex-1 overflow-y-auto">
			{#if activeView === 'settings'}
				<div class="mx-auto max-w-2xl p-16">
					<h2 class="mb-12 text-2xl font-black tracking-tighter uppercase">Settings</h2>
					<div class="space-y-12">
						<section>
							<h3 class="text-label mb-6">Appearance</h3>
							<div
								class="flex items-center justify-between border-b border-gray-100 pb-6 dark:border-[#2b2b2b]"
							>
								<div>
									<p class="text-sm font-bold">Dark Mode</p>
									<p class="text-xs opacity-50">Adjust the interface theme</p>
								</div>
								<button
									onclick={toggleTheme}
									class="input-base min-w-25 text-[10px] font-bold uppercase"
								>
									{isDarkMode ? 'Disable' : 'Enable'}
								</button>
							</div>
						</section>
						<section>
							<h3 class="text-label mb-6">About</h3>
							<p class="font-mono text-xs leading-loose opacity-40">
								PowerNote v1.0.0<br />
								Minimalist Cloud Editor for Synthetix.
							</p>
						</section>
					</div>
				</div>
			{:else if selectedFile && !selectedFile.is_folder}
				<textarea
					bind:value={selectedFile.content}
					class="h-full w-full resize-none bg-transparent p-10 font-mono text-[16px] leading-relaxed outline-none"
					spellcheck="false"
					placeholder="Start typing..."
				></textarea>
			{:else}
				<div
					class="flex h-full flex-col items-center justify-center text-[11px] font-bold tracking-[0.5em] uppercase opacity-10"
				>
					<span>PowerNote</span>
					<span class="mt-2 tracking-widest">No active item</span>
				</div>
			{/if}
		</div>
	</main>
</div>

{#if showModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
		<div
			class="w-100 border p-10 shadow-2xl"
			style="background-color: var(--bg-modal); border-color: var(--border-color);"
		>
			<h3 class="modal-title mb-8">{showModal}</h3>
			<div class="space-y-8">
				{#if showModal === 'create'}
					<div class="flex border p-1" style="border-color: var(--border-color);">
						<button
							type="button"
							onclick={() => (createType = 'file')}
							class="flex-1 py-2 text-[11px] font-bold uppercase"
							style="background-color: {createType === 'file'
								? 'var(--accent-color)'
								: 'transparent'}; color: {createType === 'file'
								? 'var(--accent-text)'
								: 'var(--text-muted)'}">File</button
						>
						<button
							type="button"
							onclick={() => (createType = 'folder')}
							class="flex-1 py-2 text-[11px] font-bold uppercase"
							style="background-color: {createType === 'folder'
								? 'var(--accent-color)'
								: 'transparent'}; color: {createType === 'folder'
								? 'var(--accent-text)'
								: 'var(--text-muted)'}">Folder</button
						>
					</div>
					<input
						bind:value={newName}
						class="input-base w-full outline-none"
						placeholder="Enter name..."
					/>
				{:else}
					<input
						type="file"
						onchange={handleImport}
						class="w-full text-sm opacity-50"
						style="color: var(--text-primary)"
					/>
				{/if}
				<Select
					label="Target Location"
					value={targetFolderId}
					options={folderOptions}
					onSelect={(id) => (targetFolderId = id)}
				/>
			</div>
			<div class="mt-12 flex gap-4">
				<button type="button" onclick={closeModals} class="btn-ghost flex-1">Cancel</button>
				{#if showModal === 'create'}
					<button type="button" onclick={handleCreate} class="btn-primary flex-1">Confirm</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
