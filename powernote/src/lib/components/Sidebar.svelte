<script lang="ts">
	import TreeItem from './TreeItem.svelte';

	let { files, onSelect, onOpenModal, onOpenSettings, selectedId, activeView } = $props<{
		files: any[];
		onSelect: (file: any) => void;
		onOpenModal: (type: 'create' | 'import') => void;
		onOpenSettings: () => void;
		selectedId: string | null;
		activeView: 'editor' | 'settings';
	}>();

	let rootItems = $derived(files.filter((f: any) => !f.parent_id));
</script>

<aside
	class="flex h-full w-64 flex-col border-r border-gray-200 bg-gray-50 dark:border-[#252526] dark:bg-[#181818]"
>
	<div class="border-b border-gray-200 p-6 dark:border-[#252526]">
		<h2 class="text-label mb-5 dark:text-white">PowerNote</h2>
		<div class="flex gap-2">
			<button
				onclick={() => onOpenModal('create')}
				class="input-base flex-1 py-1.5 text-[11px] font-bold uppercase transition-all hover:bg-gray-50 dark:hover:bg-[#444]"
				>New</button
			>
			<button
				onclick={() => onOpenModal('import')}
				class="input-base flex-1 py-1.5 text-[11px] font-bold uppercase transition-all hover:bg-gray-50 dark:hover:bg-[#444]"
				>Open</button
			>
		</div>
	</div>

	<nav class="flex-1 overflow-y-auto pt-4 pb-10">
		<div class="text-label mb-3 px-6">Explorer</div>
		{#each rootItems as item}
			<TreeItem {item} allFiles={files} {onSelect} {selectedId} />
		{:else}
			<div class="px-6 py-4 text-[12px] opacity-20 text-center uppercase tracking-tighter">
				No items
			</div>
		{/each}
	</nav>

	<div class="border-t border-gray-200 p-4 dark:border-[#252526]">
		<button
			onclick={onOpenSettings}
			class="flex w-full items-center gap-3 px-3 py-2 text-[12px] font-bold tracking-widest uppercase transition-colors
			{activeView === 'settings'
				? 'text-(--accent-color)'
				: 'text-(--text-muted) hover:text-(--text-primary)'}"
		>
			<span class="text-lg">⚙</span>
			Settings
		</button>
	</div>
</aside>
