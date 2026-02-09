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

<div class="relative flex flex-col gap-2.5">
	{#if label}
		<label for={selectId} class="text-label ml-0.5 text-left">{label}</label>
	{/if}

	<button
		id={selectId}
		type="button"
		onclick={() => (isOpen = !isOpen)}
		class="input-base flex w-full items-center justify-between text-left"
		style="border-color: {isOpen ? 'var(--accent-color)' : 'var(--border-color)'}"
	>
		<span class="truncate {value === null ? 'opacity-40' : ''}">{selectedName}</span>
		<span class="text-[10px] opacity-30">{isOpen ? '▲' : '▼'}</span>
	</button>

	{#if isOpen}
		<button
			type="button"
			aria-label="Close dropdown"
			class="fixed inset-0 z-60 cursor-default bg-transparent outline-none"
			onclick={() => (isOpen = false)}
		></button>

		<div
			class="absolute top-full left-0 z-70 mt-1 max-h-64 w-full overflow-y-auto border shadow-2xl"
			style="background-color: var(--bg-modal); border-color: var(--border-color);"
		>
			{#each options as opt (opt.id)}
				<button
					type="button"
					onclick={() => handlePick(opt.id)}
					class="relative w-full px-5 py-3 text-left text-[13px] tracking-tight transition-colors hover:opacity-70"
					style="color: var(--text-primary); background-color: {value === opt.id
						? 'var(--bg-input)'
						: 'transparent'}"
				>
					{#if value === opt.id}
						<div
							class="absolute top-0 left-0 h-full w-1"
							style="background-color: var(--accent-color)"
						></div>
					{/if}
					{opt.name}
				</button>
			{/each}
		</div>
	{/if}
</div>
