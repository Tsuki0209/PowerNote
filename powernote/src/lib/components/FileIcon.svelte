<script lang="ts">
	let {
		extension,
		tags,
		className = 'h-4 w-4'
	} = $props<{
		extension: string;
		tags?: any[];
		className?: string;
	}>();

	// 拡張子による判定 [cite: 238, 239]
	function isImage(ext: string) {
		return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext?.toLowerCase());
	}
	function isVideo(ext: string) {
		return ['mp4', 'webm', 'ogg'].includes(ext?.toLowerCase());
	}

	// 色はタグがあればその色、なければ currentColor
	let iconColor = $derived(tags && tags.length > 0 ? tags[0].color : 'currentColor');
</script>

<svg
	class={className}
	viewBox="0 0 24 24"
	fill="none"
	stroke={iconColor}
	stroke-width="2.5"
	stroke-linecap="round"
	stroke-linejoin="round"
>
	{#if isImage(extension)}
		<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
		<circle cx="8.5" cy="8.5" r="1.5" />
		<polyline points="21 15 16 10 5 21" />
	{:else if isVideo(extension)}
		<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
		<line x1="7" y1="2" x2="7" y2="22" />
		<line x1="17" y1="2" x2="17" y2="22" />
		<line x1="2" y1="12" x2="22" y2="12" />
		<line x1="2" y1="7" x2="7" y2="7" />
		<line x1="2" y1="17" x2="7" y2="17" />
		<line x1="17" y1="17" x2="22" y2="17" />
		<line x1="17" y1="7" x2="22" y2="7" />
	{:else}
		<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
		<polyline points="14 2 14 8 20 8" />
		<line x1="16" y1="13" x2="8" y2="13" />
		<line x1="16" y1="17" x2="8" y2="17" />
		<polyline points="10 9 9 9 8 9" />
	{/if}
</svg>
