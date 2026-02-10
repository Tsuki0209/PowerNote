export type PaneNode = {
	id: string;
	type: 'split' | 'file';
	direction?: 'vertical' | 'horizontal';
	ratio?: number;
	children?: [PaneNode, PaneNode];
	fileId?: string;
};