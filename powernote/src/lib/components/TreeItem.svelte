<script lang="ts">
	import { supabase } from '$lib/supabaseClient'; // 追加
	import TreeItem from './TreeItem.svelte';

	let { item, allFiles, onSelect, selectedId, onOpenActions } = $props<{
		item: any;
		allFiles: any[];
		onSelect: (file: any) => void;
		selectedId: string | null;
		onOpenActions: (item: any) => void;
	}>();

	// DBの値を直接参照（同期のため）
	let children = $derived(allFiles.filter((f: any) => f.parent_id === item.id));

	async function handleToggle() {
		if (item.is_folder) {
			const nextState = !item.is_expanded;
			// 1. UIを即時更新（楽観的更新）
			item.is_expanded = nextState;

			// 2. Supabaseに同期
			const { error } = await supabase
				.from('files')
				.update({ is_expanded: nextState })
				.eq('id', item.id);

			if (error) {
				// 失敗時は戻す
				item.is_expanded = !nextState;
				console.error('Failed to sync expand state:', error);
			}
		} else {
			onSelect(item);
		}
	}
</script>

<div class="group/item relative mb-1 select-none">
	<button
		onclick={handleToggle}
		class="group flex w-full items-center rounded-xl px-4 py-2 text-[14px] font-medium transition-all
        {selectedId === item.id
			? 'bg-(--accent-color)/10 text-(--accent-color)'
			: 'text-(--text-primary) hover:bg-black/5 dark:hover:bg-white/5'}"
	>
		<span
			class="mr-3 flex h-4 w-4 items-center justify-center opacity-40"
			style={item.tags?.length > 0 ? 'opacity: 1;' : ''}
		>
			{#if item.is_folder}
				<svg
					class="h-3.5 w-3.5 transition-transform {item.is_expanded ? 'rotate-90' : ''}"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="3"><path d="M9 18l6-6-6-6" /></svg
				>
			{:else}
				<svg
					class="h-4 w-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke={item.tags?.length > 0 ? item.tags[0].color : 'currentColor'}
					stroke-width="2"
				>
					<path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
					<path d="M13 2v7h7" />
				</svg>
			{/if}
		</span>
		<span class="truncate tracking-tight">
			{item.name}{item.is_folder ? '' : '.' + item.extension}
		</span>
	</button>

	<button
		onclick={(e) => {
			e.stopPropagation();
			onOpenActions(item);
		}}
		class="absolute top-1.5 right-2 flex h-7 w-7 items-center justify-center rounded-lg opacity-0 transition-all group-hover/item:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"
		aria-label="Item actions"
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

	{#if item.is_folder && item.is_expanded}
		<div class="mt-1 ml-6 border-l-2 border-(--border-color)/30">
			{#each children as child (child.id)}
				<TreeItem item={child} {allFiles} {onSelect} {selectedId} {onOpenActions} />
			{:else}
				<div class="py-2 pl-4 text-[11px] font-bold uppercase opacity-10 tracking-widest">
					Empty
				</div>
			{/each}
		</div>
	{/if}
</div>
