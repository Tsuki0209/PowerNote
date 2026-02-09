<script lang="ts">
	import TreeItem from './TreeItem.svelte';

	let { item, allFiles, onSelect, selectedId } = $props<{
		item: any;
		allFiles: any[];
		onSelect: (file: any) => void;
		selectedId: string | null;
	}>();

	let isOpen = $state(false);
	// このアイテムを親に持つ子要素を抽出
	let children = $derived(allFiles.filter((f: any) => f.parent_id === item.id));

	function handleToggle() {
		if (item.is_folder) {
			isOpen = !isOpen;
		} else {
			onSelect(item);
		}
	}
</script>

<div class="select-none">
	<button
		onclick={handleToggle}
		class="group flex w-full items-center px-4 py-2 text-[14px] transition-colors
		{selectedId === item.id
			? 'bg-gray-200 text-black dark:bg-[#37373d] dark:text-white'
			: 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#2a2d2e]'}"
	>
		<span class="mr-3 inline-block w-4 text-center font-mono opacity-40">
			{#if item.is_folder}
				{isOpen ? '−' : '+'}
			{:else}
				&nbsp;
			{/if}
		</span>
		<span class="truncate tracking-tight">
			{item.name}{item.is_folder ? '' : '.' + item.extension}
		</span>
	</button>

	{#if item.is_folder && isOpen}
		<div class="ml-6 border-l border-gray-200 dark:border-[#333]">
			{#each children as child}
				<TreeItem item={child} {allFiles} {onSelect} {selectedId} />
			{/each}
		</div>
	{/if}
</div>
