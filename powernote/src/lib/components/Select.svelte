<script lang="ts">
	interface SelectOption {
		id: any;
		name: string;
	}

	let { label, value, options, onSelect } = $props<{
		label?: string;
		value: any;
		options: SelectOption[];
		onSelect: (id: any) => void;
	}>();

	let isOpen = $state(false);
	const selectId = `select-${Math.random().toString(36).slice(2, 9)}`;

	let selectedName = $derived(
		options.find((opt: SelectOption) => opt.id === value)?.name || 'Select option'
	);

	function handlePick(id: any) {
		onSelect(id);
		isOpen = false;
	}
</script>

<div class="relative flex flex-col gap-2">
	{#if label}
		<label for={selectId} class="text-label ml-1">{label}</label>
	{/if}

	<button
		id={selectId}
		type="button"
		onclick={() => (isOpen = !isOpen)}
		class="input-base flex w-full items-center justify-between border border-transparent text-left shadow-sm"
		style="border-color: {isOpen ? 'var(--accent-color)' : 'transparent'}"
	>
		<span class="truncate {value === null ? 'font-normal opacity-40' : 'font-bold'}"
			>{selectedName}</span
		>
		<svg
			class="h-3 w-3 opacity-30 transition-transform {isOpen ? 'rotate-180' : ''}"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="3"><path d="M19 9l-7 7-7-7" /></svg
		>
	</button>

	{#if isOpen}
		<button
			type="button"
			aria-label="Close dropdown"
			class="fixed inset-0 z-60 cursor-default bg-transparent outline-none"
			onclick={() => (isOpen = false)}
		></button>

		<div
			class="absolute top-full left-0 z-70 mt-2 max-h-64 w-full overflow-hidden rounded-2xl border border-(--border-color) bg-(--bg-modal) shadow-2xl"
		>
			<div class="max-h-60 overflow-y-auto p-1">
				{#each options as opt (opt.id)}
					<button
						type="button"
						onclick={() => handlePick(opt.id)}
						class="w-full rounded-xl px-4 py-3 text-left text-[13px] font-semibold transition-colors hover:bg-black/5 dark:hover:bg-white/5"
						style="color: var(--text-primary); {value === opt.id
							? 'background-color: var(--accent-color); color: white;'
							: ''}"
					>
						{opt.name}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
