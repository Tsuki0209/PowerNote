<script lang="ts">
	type LayoutMode = '1' | 'V2' | 'H2' | 'V3' | 'Grid4' | 'Grid6';

	let {
		files,
		layoutMode = $bindable('1'),
		viewStates = $bindable(['']),
		activeViewIndex = $bindable(0),
		onOpenActions,
		isImage,
		isVideo
	} = $props<{
		files: any[];
		layoutMode: LayoutMode;
		viewStates: string[];
		activeViewIndex: number;
		onOpenActions: (file: any) => void;
		isImage: (ext: string) => boolean;
		isVideo: (ext: string) => boolean;
	}>();

	const gridClasses: Record<LayoutMode, string> = {
		'1': 'grid-cols-1',
		V2: 'grid-cols-2',
		H2: 'grid-rows-2',
		V3: 'grid-cols-3',
		Grid4: 'grid-cols-2 grid-rows-2',
		Grid6: 'grid-cols-3 grid-rows-2'
	};

	// layoutMode の型を明示的に LayoutMode と指定して取得する関数
	const getGridClass = (mode: LayoutMode) => gridClasses[mode];

	const getViewCount = (m: LayoutMode) => ({ '1': 1, V2: 2, H2: 2, V3: 3, Grid4: 4, Grid6: 6 })[m];

	// レイアウト変更時に viewStates の数を調整
	$effect(() => {
		const count = getViewCount(layoutMode);
		let updated = [...viewStates];
		while (updated.length < count) updated.push('');
		if (updated.length !== viewStates.length) {
			viewStates = updated;
		}
		if (activeViewIndex >= count) activeViewIndex = 0;
	});
</script>

<div class="grid h-full w-full divide-(--border-color)/30 {getGridClass(layoutMode)}">
	{#each Array(getViewCount(layoutMode)) as _, i}
		{@const viewId = viewStates[i]}
		{@const viewFile = files.find((f: any) => f.id === viewId)}

		<div
			role="presentation"
			onclick={() => (activeViewIndex = i)}
			class="group/pane relative flex flex-col border border-(--border-color)/10 transition-colors {activeViewIndex ===
			i
				? 'bg-(--accent-color)/2 ring-2 ring-(--accent-color)/20 ring-inset'
				: ''}"
		>
			{#if viewFile}
				<div
					class="absolute top-6 right-6 z-20 opacity-100 transition-opacity lg:opacity-0 lg:group-hover/pane:opacity-100"
				>
					<button
						onclick={() => onOpenActions(viewFile)}
						aria-label="Open file actions"
						class="flex h-8 w-8 items-center justify-center rounded-full border border-(--border-color)/50 bg-(--bg-sidebar)/80 shadow-lg backdrop-blur-md hover:scale-110"
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
						placeholder="Start writing..."
					></textarea>
				{/if}
			{:else}
				<div
					class="m-4 flex h-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-(--border-color)/10"
				>
					<span class="text-[9px] font-black tracking-widest uppercase opacity-20"
						>View {i + 1}: Select file</span
					>
				</div>
			{/if}
		</div>
	{/each}
</div>
