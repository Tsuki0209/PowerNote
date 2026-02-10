<script lang="ts">
	import type { PaneNode } from '$lib/types';
	// Svelte 5では自分自身のコンポーネント名をインポートして再帰呼び出しします
	import SplitView from './SplitView.svelte';

	let {
		node = $bindable(),
		files,
		activeViewId = $bindable(''), // インデックスではなくIDで管理
		onOpenActions,
		isImage,
		isVideo
	} = $props<{
		node: PaneNode;
		files: any[];
		activeViewId: string;
		onOpenActions: (file: any) => void;
		isImage: (ext: string) => boolean;
		isVideo: (ext: string) => boolean;
	}>();

	const handlePaneClick = () => {
		if (node.type === 'file') {
			activeViewId = node.id;
		}
	};
</script>

<div class="h-full w-full">
	{#if node.type === 'split' && node.children}
		<div
			class="flex h-full w-full {node.direction === 'vertical'
				? 'flex-col'
				: 'flex-row'} divide-(--border-color)/30"
		>
			<div style="flex: {node.ratio || 50}%">
				<SplitView
					bind:node={node.children[0]}
					{files}
					bind:activeViewId
					{onOpenActions}
					{isImage}
					{isVideo}
				/>
			</div>

			<div
				class="{node.direction === 'vertical'
					? 'h-1 w-full cursor-ns-resize'
					: 'h-full w-1 cursor-ew-resize'} bg-(--border-color)/10 transition-colors hover:bg-(--accent-color)/50"
			></div>

			<div style="flex: {100 - (node.ratio || 50)}%">
				<SplitView
					bind:node={node.children[1]}
					{files}
					bind:activeViewId
					{onOpenActions}
					{isImage}
					{isVideo}
				/>
			</div>
		</div>
	{:else}
		{@const viewFile = files.find((f: any) => f.id === node.fileId)}
		<div
			role="presentation"
			onclick={handlePaneClick}
			class="group/pane relative flex h-full w-full flex-col border border-(--border-color)/10 transition-colors {activeViewId ===
			node.id
				? 'bg-(--accent-color)/2 ring-2 ring-(--accent-color)/20 ring-inset'
				: ''}"
		>
			{#if viewFile}
				<div
					class="absolute top-6 right-6 z-20 opacity-100 transition-opacity lg:opacity-0 lg:group-hover/pane:opacity-100"
				>
					<button
						onclick={() => onOpenActions(viewFile)}
						class="flex h-8 w-8 items-center justify-center rounded-full border border-(--border-color)/50 bg-(--bg-sidebar)/80 shadow-lg backdrop-blur-md hover:scale-110"
						aria-label="Open actions"
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
				</div>

				{#if isImage(viewFile.extension)}
					<div class="flex h-full w-full items-center justify-center p-8">
						<img
							src={viewFile.content}
							alt={viewFile.name}
							class="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
						/>
					</div>
				{:else if isVideo(viewFile.extension)}
					<div class="flex h-full w-full items-center justify-center p-8">
						<video
							controls
							muted
							src={viewFile.content}
							class="max-h-full max-w-full rounded-xl shadow-2xl"
						>
							<track kind="captions" />
						</video>
					</div>
				{:else}
					<textarea
						bind:value={viewFile.content}
						class="h-full w-full resize-none overflow-y-auto border-none bg-transparent p-5 font-mono text-[15px] leading-relaxed outline-none focus:ring-0"
						spellcheck="false"
					></textarea>
				{/if}
			{:else}
				<div
					class="m-4 flex h-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-(--border-color)/10"
				>
					<span class="text-[9px] font-black tracking-widest uppercase opacity-20"
						>Select file in this pane</span
					>
				</div>
			{/if}
		</div>
	{/if}
</div>
