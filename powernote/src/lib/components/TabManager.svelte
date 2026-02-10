<script lang="ts">
	import FileIcon from './FileIcon.svelte';
	import { onMount } from 'svelte'; // 追加
	import Sortable from 'sortablejs'; // 追加
	interface Props {
		tabs: any[];
		activeTabId: string | null;
		// draggingTabId は削除
		canScrollLeft: boolean;
		canScrollRight: boolean;
		scrollContainer: HTMLDivElement | null;
		onSelect: (tab: any) => void;
		onClose: (id: string, e: MouseEvent) => void;
		onReorder: (newTabs: any[]) => void; // 追加
		onScroll: () => void;
		onWheel: (e: WheelEvent) => void;
		scrollTabs: (direction: 'left' | 'right') => void;
	}

	let {
		tabs,
		activeTabId,
		// draggingTabId は削除
		canScrollLeft,
		canScrollRight,
		scrollContainer = $bindable(),
		onSelect,
		onClose,
		onReorder, // 追加
		onScroll,
		onWheel,
		scrollTabs
	}: Props = $props();

	onMount(() => {
		if (!scrollContainer) return;

		let scrollInterval: number | null = null;

		const stopScrolling = () => {
			if (scrollInterval) {
				clearInterval(scrollInterval);
				scrollInterval = null;
			}
		};

		// --- ドラッグ中のマウス位置を直接監視 ---
		const handleDragOver = (e: MouseEvent | TouchEvent) => {
			// SortableJSがドラッグ中の時だけ動かす
			const ghost = document.querySelector('.sortable-ghost');
			if (!ghost) {
				stopScrolling();
				return;
			}

			const container = scrollContainer!;
			const rect = container.getBoundingClientRect();

			// マウスかタッチから座標を取得
			const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;

			const threshold = 70; // 端から70pxで反応
			const speed = 12;

			if (clientX > rect.right - threshold) {
				if (!scrollInterval) {
					scrollInterval = window.setInterval(() => {
						container.scrollLeft += speed;
					}, 16);
				}
			} else if (clientX < rect.left + threshold) {
				if (!scrollInterval) {
					scrollInterval = window.setInterval(() => {
						container.scrollLeft -= speed;
					}, 16);
				}
			} else {
				stopScrolling();
			}
		};

		// イベント登録
		scrollContainer.addEventListener('dragover', handleDragOver);
		// スマホ用 (SortableJSのforceFallback時はこちらが重要)
		window.addEventListener('touchmove', handleDragOver, { passive: false });
		// PCでのforceFallback時はmousemoveが飛ぶ
		window.addEventListener('mousemove', handleDragOver);

		Sortable.create(scrollContainer, {
			animation: 250,
			delay: 300,
			delayOnTouchOnly: true,
			touchStartThreshold: 5,
			fallbackTolerance: 3,
			swapThreshold: 0.65,
			draggable: '[role="listitem"]',
			ghostClass: 'sortable-ghost',
			forceFallback: true,
			fallbackOnBody: true,

			onMove: (evt) => {
				const draggedIdx = parseInt(evt.dragged.dataset.index || '0');
				const targetIdx = parseInt(evt.related.dataset.index || '0');
				const draggedTab = tabs[draggedIdx];
				const targetTab = tabs[targetIdx];
				if (draggedTab && targetTab && draggedTab.is_pinned !== targetTab.is_pinned) {
					return false;
				}
			},
			onEnd: (evt) => {
				stopScrolling();
				if (evt.oldIndex === evt.newIndex) return;
				const newTabs = [...tabs];
				const [movedItem] = newTabs.splice(evt.oldIndex!, 1);
				newTabs.splice(evt.newIndex!, 0, movedItem);
				onReorder(newTabs);
			}
		});

		return () => {
			stopScrolling();
			scrollContainer?.removeEventListener('dragover', handleDragOver);
			window.removeEventListener('touchmove', handleDragOver);
			window.removeEventListener('mousemove', handleDragOver);
			window.removeEventListener('mouseup', stopScrolling);
			window.removeEventListener('touchend', stopScrolling);
		};
	});
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
		{#each tabs as tab, i (tab.id)}
			<div
				role="listitem"
				data-id={tab.id}
				data-index={i}
				class="group relative flex h-9 w-40 shrink-0 cursor-grab items-center overflow-hidden rounded-full select-none {activeTabId ===
				tab.id
					? 'bg-(--accent-color)/10 ring-1 ring-(--accent-color)/30'
					: 'bg-(--bg-main)/50 hover:bg-black/5 dark:hover:bg-white/5'}"
			>
				<button
					onclick={() => onSelect(tab)}
					class="flex h-full min-w-0 flex-1 items-center gap-2 pr-2 pl-4 text-[12px] font-bold"
				>
					<div
						class="flex h-4 w-4 items-center justify-center opacity-40"
						style={tab.tags?.length > 0 ? 'opacity: 1;' : ''}
					>
						<FileIcon extension={tab.extension} tags={tab.tags} className="h-3.5 w-3.5" />
					</div>

					<span
						class="truncate {activeTabId === tab.id
							? 'text-(--accent-color)'
							: 'text-(--text-muted)'}">{tab.name}.{tab.extension}</span
					>
				</button>
				{#if tab.is_pinned}
					<div class="absolute right-3 text-(--accent-color)">
						<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
							<path
								d="M9 4v1.2a5 5 0 0 0 1.5 3.5l.5.5v4.4l-2 3v1h8v-1l-2-3V9.2l.5-.5a5 5 0 0 0 1.5-3.5V4H9Z"
							/>
							<path d="M12 17v7" />
						</svg>
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
							stroke-width="3"
						>
							<path d="M18 6L6 18M6 6l12 12" />
						</svg>
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

	[role='listitem'] {
		touch-action: none;
		-webkit-user-drag: none; /* iOS Safari用 */
	}
</style>
