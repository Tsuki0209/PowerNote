import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(), // これを忘れるとSvelteファイル内のCSSでエラーが出ることがあります
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: '404.html', // 追記：GitHub Pagesでリロードした際のエラーを防ぐ
			precompress: false,
			strict: true
		}),
		paths: {
			// 追記：リポジトリ名が "PowerNote" なら '/PowerNote' に書き換えてください
			// カスタムドメインを使う場合は空文字 '' でOKです
			base: process.env.NODE_ENV === 'production' ? '/PowerNote' : '',
		}
	}
};

export default config;