<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { onMount } from 'svelte';

	let memos = $state<any[]>([]); // メモ一覧を保持
	let newMemo = $state(''); // 入力中の文字

	// 1. メモを読み込む
	async function fetchMemos() {
		const { data } = await supabase
			.from('memos')
			.select('*')
			.order('created_at', { ascending: false });
		memos = data || [];
	}

	// 2. メモを保存する
	async function addMemo() {
		if (!newMemo) return;
		await supabase.from('memos').insert([{ content: newMemo }]);
		newMemo = '';
		fetchMemos(); // 再読み込み
	}

	onMount(fetchMemos);
</script>

<div class="mx-auto flex max-w-md flex-col gap-4 p-4">
	<h1 class="text-2xl font-bold">PowerNote</h1>

	<div class="flex gap-2">
		<input bind:value={newMemo} class="flex-1 rounded border p-2" placeholder="メモを入力..." />
		<button onclick={addMemo} class="rounded bg-blue-500 px-4 py-2 text-white">追加</button>
	</div>

	<ul class="space-y-2">
		{#each memos as memo}
			<li class="rounded bg-gray-100 p-3 shadow-sm">{memo.content}</li>
		{/each}
	</ul>
</div>
