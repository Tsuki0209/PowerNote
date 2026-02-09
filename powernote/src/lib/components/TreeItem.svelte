<script lang="ts">
	import TreeItem from './TreeItem.svelte'; // 自己参照のために必要

	let { item, allFiles, onSelect, selectedId } = $props<{
		item: any;
		allFiles: any[];
		onSelect: (file: any) => void;
		selectedId: string | null;
	}>();

	let isOpen = $state(false);
	let children = $derived(allFiles.filter((f: any) => f.parent_id === item.id));

	function handleToggle() {
		if (item.is_folder) {
			isOpen = !isOpen;
		} else {
			onSelect(item);
		}
	}
</script>

<div class="mb-1 select-none">
	<button
		onclick={handleToggle}
		class="group flex w-full items-center rounded-xl px-4 py-2 text-[14px] font-medium transition-all
        {selectedId === item.id
			? 'bg-(--accent-color)/10 text-(--accent-color)'
			: 'text-(--text-primary) hover:bg-black/5 dark:hover:bg-white/5'}"
	>
		<span class="mr-3 flex h-4 w-4 items-center justify-center opacity-40">
			{#if item.is_folder}
				<svg
					class="h-3.5 w-3.5 transition-transform {isOpen ? 'rotate-90' : ''}"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="3"><path d="M9 18l6-6-6-6" /></svg
				>
			{:else}
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
					><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" /><path
						d="M13 2v7h7"
					/></svg
				>
			{/if}
		</span>
		<span class="truncate tracking-tight">
			{item.name}{item.is_folder ? '' : '.' + item.extension}
		</span>
	</button>

	{#if item.is_folder && isOpen}
		<div class="mt-1 ml-6 border-l-2 border-(--border-color)/30">
			{#each children as child}
				<TreeItem item={child} {allFiles} {onSelect} {selectedId} />
			{/each}
		</div>
	{/if}
</div>
