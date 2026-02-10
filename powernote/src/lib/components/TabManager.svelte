<script lang="ts">
	interface Props {
		tabs: any[];
		activeTabId: string | null;
		draggingTabId: string | null;
		canScrollLeft: boolean;
		canScrollRight: boolean;
		scrollContainer: HTMLDivElement | null;
		onSelect: (tab: any) => void;
		onClose: (id: string, e: MouseEvent) => void;
		onDragStart: (id: string) => void;
		onDragOver: (e: DragEvent, id: string) => void;
		onDragEnd: () => void;
		onScroll: () => void;
		onWheel: (e: WheelEvent) => void;
		scrollTabs: (direction: 'left' | 'right') => void;
	}

	let {
		tabs,
		activeTabId,
		draggingTabId,
		canScrollLeft,
		canScrollRight,
		scrollContainer = $bindable(),
		onSelect,
		onClose,
		onDragStart,
		onDragOver,
		onDragEnd,
		onScroll,
		onWheel,
		scrollTabs
	}: Props = $props();
</script>

<div class="group/header relative h-full flex-1 overflow-hidden">
	{#if canScrollLeft}
		<div
			class="absolute left-0 z-10 flex h-full items-center bg-linear-to-r from-(--bg-sidebar) via-(--bg-sidebar) to-transparent pr-12"
		>
			<button
				onclick={() => scrollTabs('left')}
				aria-label="Scroll Tabs Left"
				class="ml-1 flex h-7 w-7 items-center justify-center rounded-full border border-(--border-color)/50 bg-(--bg-sidebar) shadow-sm hover:scale-110"
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
					><path d="M15 18l-6-6 6-6" /></svg
				>
			</button>
		</div>
	{/if}

	<div
		bind:this={scrollContainer}
		onscroll={onScroll}
		onwheel={onWheel}
		role="list"
		class="scrollbar-none flex h-full items-center gap-2 overflow-x-auto scroll-smooth px-4"
	>
		{#each tabs as tab (tab.id)}
			<div
				role="listitem"
				draggable="true"
				ondragstart={() => onDragStart(tab.id)}
				ondragover={(e) => onDragOver(e, tab.id)}
				ondragend={onDragEnd}
				class="group relative flex h-9 w-40 shrink-0 cursor-grab items-center overflow-hidden rounded-full transition-all active:cursor-grabbing {activeTabId ===
				tab.id
					? 'bg-(--accent-color)/10 ring-1 ring-(--accent-color)/30'
					: 'bg-(--bg-main)/50 hover:bg-black/5 dark:hover:bg-white/5'} {draggingTabId === tab.id
					? 'opacity-40'
					: 'opacity-100'}"
			>
				<button
					onclick={() => onSelect(tab)}
					class="flex h-full min-w-0 flex-1 items-center gap-2 pr-2 pl-4 text-[12px] font-bold"
				>
					<svg
						class="h-3.5 w-3.5"
						viewBox="0 0 24 24"
						fill="none"
						stroke={tab.tags?.length > 0 ? tab.tags[0].color : 'currentColor'}
						stroke-width="2.5"
						><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" /><path
							d="M13 2v7h7"
						/></svg
					>
					<span
						class="truncate {activeTabId === tab.id
							? 'text-(--accent-color)'
							: 'text-(--text-muted)'}">{tab.name}.{tab.extension}</span
					>
				</button>
				{#if tab.is_pinned}
					<div class="absolute right-3 text-(--accent-color)">
						<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"
							><path
								d="M9 4v1.2a5 5 0 0 0 1.5 3.5l.5.5v4.4l-2 3v1h8v-1l-2-3V9.2l.5-.5a5 5 0 0 0 1.5-3.5V4H9Z"
							/><path d="M12 17v7" /></svg
						>
					</div>
				{:else}
					<button
						onclick={(e) => onClose(tab.id, e)}
						aria-label="Close tab"
						class="absolute right-2 rounded-full p-1 opacity-0 group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"
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
				aria-label="Scroll Tabs Right"
				class="mr-1 flex h-7 w-7 items-center justify-center rounded-full border border-(--border-color)/50 bg-(--bg-sidebar) shadow-sm hover:scale-110"
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
					><path d="M9 18l6-6-6-6" /></svg
				>
			</button>
		</div>
	{/if}
</div>

<style>
	.scrollbar-none::-webkit-scrollbar {
		display: none;
	}
	.scrollbar-none {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
</style>
