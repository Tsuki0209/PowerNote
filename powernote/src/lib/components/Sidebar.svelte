<script lang="ts">
	import TreeItem from './TreeItem.svelte';

	let { files, onSelect, onOpenModal, onOpenSettings, onOpenActions, selectedId, activeView } =
		$props<{
			files: any[];
			onSelect: (file: any) => void;
			onOpenModal: (type: 'create' | 'import') => void;
			onOpenSettings: () => void;
			onOpenActions: (item: any) => void;
			selectedId: string | null;
			activeView: 'editor' | 'settings';
		}>();

	let searchQuery = $state('');
	let searchMode = $state<'name' | 'tag' | 'content'>('name');

	// 検索ロジック：検索時はフォルダを除外し、条件に合うファイルのみを抽出
	let displayItems = $derived(
		searchQuery.trim() === ''
			? files.filter((f: any) => !f.parent_id) // 通常時：ルート項目
			: files.filter((f: any) => {
					if (f.is_folder) return false; // 検索時はフォルダを表示しない
					const query = searchQuery.toLowerCase();
					if (searchMode === 'name') return f.name.toLowerCase().includes(query);
					if (searchMode === 'tag')
						return f.tags?.some((t: any) => t.name.toLowerCase().includes(query));
					if (searchMode === 'content') return f.content?.toLowerCase().includes(query);
					return false;
				})
	);
</script>

<aside
	class="flex h-full w-68 flex-col overflow-hidden rounded-3xl border border-(--border-color) bg-(--bg-sidebar) shadow-sm"
>
	<div class="p-8">
		<div class="mb-8 flex items-center gap-3">
			<div
				class="flex h-8 w-8 items-center justify-center rounded-xl bg-(--accent-color) text-white shadow-(--accent-color)/20 shadow-lg"
			>
				<svg
					class="h-5 w-5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
				>
					<path d="M12 19l7-7 3 3-7 7-3-3z" /><path
						d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"
					/><path d="M2 2l7.5 1.5" /><path d="M13 18l1.5 7.5" />
				</svg>
			</div>
			<h2 class="text-lg font-black tracking-tight">PowerNote</h2>
		</div>

		<div class="flex gap-2">
			<button
				onclick={() => onOpenModal('create')}
				class="btn-primary flex flex-1 items-center justify-center gap-2 py-3"
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
					><path d="M12 5v14M5 12h14" /></svg
				>
				<span class="text-xs">New</span>
			</button>
			<button
				onclick={() => onOpenModal('import')}
				class="btn-ghost flex flex-1 items-center justify-center gap-2 border border-(--border-color)/50 py-3"
			>
				<svg
					class="h-4 w-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg
				>
				<span class="text-xs">Import</span>
			</button>
		</div>

		<div class="mt-6 space-y-2">
			<div class="flex rounded-xl bg-black/5 p-1 dark:bg-white/5">
				{#each ['name', 'tag', 'content'] as mode}
					<button
						onclick={() => (searchMode = mode as any)}
						class="flex-1 rounded-lg py-2 text-[10px] font-bold uppercase transition-all {searchMode ===
						mode
							? 'bg-white text-(--accent-color) shadow-sm dark:bg-white/10 dark:text-white'
							: 'text-(--text-muted) opacity-60 hover:opacity-100'}"
					>
						{mode}
					</button>
				{/each}
			</div>

			<div
				class="relative flex h-9 items-center justify-center overflow-hidden rounded-xl bg-black/5 transition-all focus-within:bg-black/10 dark:bg-white/5 dark:focus-within:bg-white/10"
			>
				<div class="pointer-events-none flex items-center justify-center pl-3">
					<svg
						class="h-3.5 w-3.5 opacity-30"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="3"
					>
						<circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
					</svg>
				</div>
				<input
					bind:value={searchQuery}
					placeholder="Search..."
					class="h-full flex-1 border-none bg-transparent px-2 text-[11px] outline-none"
				/>
			</div>
		</div>
	</div>

	<nav class="flex-1 overflow-y-auto px-4 pb-6">
		<div class="text-label mb-4 px-4">{searchQuery ? 'Search Results' : 'Explorer'}</div>
		{#each displayItems as item (item.id)}
			<TreeItem {item} allFiles={files} {onSelect} {selectedId} {onOpenActions} />
		{:else}
			<div class="py-10 text-center text-[11px] font-bold uppercase opacity-20 tracking-widest">
				No items
			</div>
		{/each}
	</nav>

	<div class="border-t border-(--border-color)/30 p-4">
		<button
			onclick={onOpenSettings}
			class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-bold transition-all {activeView ===
			'settings'
				? 'bg-(--accent-color) text-white shadow-lg'
				: 'text-(--text-muted) hover:bg-black/5 dark:hover:bg-white/5'}"
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
				><circle cx="12" cy="12" r="3" /><path
					d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
				/></svg
			>
			Settings
		</button>
	</div>
</aside>
