import { Disposable } from '../../base/common/lifecycle.js';
import { IWorkbenchContribution } from '../common/contributions.js';
import { Registry } from '../../platform/registry/common/platform.js';
import { Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry } from '../common/contributions.js';
import { LifecyclePhase } from '../services/lifecycle/common/lifecycle.js';
import { registerAction2, Action2 } from '../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../platform/instantiation/common/instantiation.js';
import { localize2 } from '../../nls.js';
import { IEditorService } from '../services/editor/common/editorService.js';
import { ICodeEditorService } from '../../editor/browser/services/codeEditorService.js';
import { ITextModel } from '../../editor/common/model.js';
import { Range } from '../../editor/common/core/range.js';
import { IModelService } from '../../editor/common/services/model.js';
import { URI } from '../../base/common/uri.js';

class CodeSnakeContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.codesnake';

	constructor() {
		super();
	}
}

class CodeSnakeGame {
	private model: ITextModel | null = null;
	private codeChars: string[] = [];
	private snake: { x: number; y: number }[] = [];
	private apple: { x: number; y: number } | null = null;
	private direction: { x: number; y: number } = { x: 1, y: 0 };
	private gridWidth = 40;
	private gridHeight = 20;
	private gameSpeed = 300;
	private gameLoop: any = null;
	private score = 0;
	private gameOver = false;
	private keyListener: any = null;
	private inputBuffer = '';

	constructor(
		private editorService: IEditorService,
		private codeEditorService: ICodeEditorService,
		private modelService: IModelService
	) {
		this.extractCodeFromEditor();
		this.createGameDocument();
	}

	private extractCodeFromEditor(): void {
		const activeEditor = this.codeEditorService.getActiveCodeEditor();
		if (activeEditor) {
			const model = activeEditor.getModel();
			if (model) {
				const text = model.getValue();
				for (const char of text) {
					if (char !== '\n' && char !== '\r' && char.trim()) {
						this.codeChars.push(char);
					}
				}
			}
		}

		if (this.codeChars.length === 0) {
			const defaultCode = 'function snake() { return "🐍"; }';
			this.codeChars = defaultCode.split('').filter(c => c.trim());
		}
	}

	private async createGameDocument(): Promise<void> {
		const uri = URI.parse('untitled:CodeSnake');

		const existing = this.modelService.getModel(uri);
		if (existing && !existing.isDisposed()) {
			this.model = existing;
		} else {
			this.model = this.modelService.createModel('', null, uri);
		}

		await this.editorService.openEditor({
			resource: uri,
			options: { pinned: true }
		});

		this.initGame();
		this.setupKeyListener();
		this.startGame();
	}

	private initGame(): void {
		this.snake = [
			{ x: Math.floor(this.gridWidth / 2), y: Math.floor(this.gridHeight / 2) },
			{ x: Math.floor(this.gridWidth / 2) - 1, y: Math.floor(this.gridHeight / 2) },
			{ x: Math.floor(this.gridWidth / 2) - 2, y: Math.floor(this.gridHeight / 2) }
		];

		this.spawnApple();
		this.direction = { x: 1, y: 0 };
		this.score = 0;
		this.gameOver = false;
		this.render();
	}

	private spawnApple(): void {
		let newApple: { x: number; y: number };
		do {
			newApple = {
				x: Math.floor(Math.random() * this.gridWidth),
				y: Math.floor(Math.random() * this.gridHeight)
			};
		} while (this.snake.some(segment => segment.x === newApple.x && segment.y === newApple.y));

		this.apple = newApple;
	}

	private setupKeyListener(): void {
		if (this.keyListener) {
			this.keyListener.dispose();
			this.keyListener = null;
		}

		const activeEditor = this.codeEditorService.getActiveCodeEditor();
		if (!activeEditor) {
			return;
		}

		this.keyListener = activeEditor.onDidChangeModelContent(() => {
			if (!this.model) {
				return;
			}

			const content = this.model.getValue();
			const lines = content.split('\n');
			const lastLine = lines[lines.length - 1].toLowerCase();

			if (this.gameOver) {
				if (lastLine.includes('r')) {
					this.clearLastLine();
					this.initGame();
					this.startGame();
				}
				return;
			}

			if (lastLine.endsWith('w') && this.direction.y === 0) {
				this.direction = { x: 0, y: -1 };
				this.clearLastLine();
			} else if (lastLine.endsWith('s') && this.direction.y === 0) {
				this.direction = { x: 0, y: 1 };
				this.clearLastLine();
			} else if (lastLine.endsWith('a') && this.direction.x === 0) {
				this.direction = { x: -1, y: 0 };
				this.clearLastLine();
			} else if (lastLine.endsWith('d') && this.direction.x === 0) {
				this.direction = { x: 1, y: 0 };
				this.clearLastLine();
			}
		});
	}

	private clearLastLine(): void {
		if (!this.model) {
			return;
		}

		const lineCount = this.model.getLineCount();
		const lastLine = this.model.getLineContent(lineCount);

		if (lastLine.trim()) {
			this.model.applyEdits([{
				range: new Range(lineCount, 1, lineCount, lastLine.length + 1),
				text: ''
			}]);
		}
	}

	private startGame(): void {
		if (this.gameLoop) {
			clearInterval(this.gameLoop);
		}

		this.gameLoop = setInterval(() => {
			this.update();
			this.render();
		}, this.gameSpeed);
	}

	private update(): void {
		if (this.gameOver) {
			return;
		}

		const head = { ...this.snake[0] };
		head.x += this.direction.x;
		head.y += this.direction.y;

		if (head.x < 0 || head.x >= this.gridWidth || head.y < 0 || head.y >= this.gridHeight) {
			this.endGame();
			return;
		}

		if (this.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
			this.endGame();
			return;
		}

		this.snake.unshift(head);

		if (this.apple && head.x === this.apple.x && head.y === this.apple.y) {
			this.score++;
			this.spawnApple();
		} else {
			this.snake.pop();
		}
	}

	private render(): void {
		if (!this.model) {
			return;
		}

		const grid: string[][] = [];
		for (let y = 0; y < this.gridHeight; y++) {
			grid[y] = [];
			for (let x = 0; x < this.gridWidth; x++) {
				grid[y][x] = ' ';
			}
		}

		this.snake.forEach((segment, index) => {
			const charIndex = index % this.codeChars.length;
			grid[segment.y][segment.x] = this.codeChars[charIndex];
		});

		if (this.apple) {
			const appleCharIndex = Math.floor(Math.random() * this.codeChars.length);
			grid[this.apple.y][this.apple.x] = this.codeChars[appleCharIndex];
		}

		let content = `CodeSnake | Score: ${this.score}\n`;
		content += '═'.repeat(this.gridWidth) + '\n';

		for (let y = 0; y < this.gridHeight; y++) {
			content += grid[y].join('') + '\n';
		}

		content += '═'.repeat(this.gridWidth) + '\n';

		if (this.gameOver) {
			content += `your game is overed... score: ${this.score} | type 'r' to restart\n`;
		} else {
			content += 'type W/A/S/D to move\n';
		}

		this.model.setValue(content);

		const activeEditor = this.codeEditorService.getActiveCodeEditor();
		if (activeEditor) {
			const lineCount = this.model.getLineCount();
			activeEditor.setPosition({ lineNumber: lineCount, column: 1 });
		}
	}

	private endGame(): void {
		this.gameOver = true;
		if (this.gameLoop) {
			clearInterval(this.gameLoop);
			this.gameLoop = null;
		}
	}

	public destroy(): void {
		if (this.gameLoop) {
			clearInterval(this.gameLoop);
			this.gameLoop = null;
		}

		if (this.keyListener) {
			this.keyListener.dispose();
			this.keyListener = null;
		}

		this.model = null;
	}
}

let currentGame: CodeSnakeGame | null = null;

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'weencode.playCodeSnake',
			title: localize2('playCodeSnake', "Play CodeSnake"),
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		if (currentGame) {
			currentGame.destroy();
			currentGame = null;
		}

		const editorService = accessor.get(IEditorService);
		const codeEditorService = accessor.get(ICodeEditorService);
		const modelService = accessor.get(IModelService);

		currentGame = new CodeSnakeGame(editorService, codeEditorService, modelService);
	}
});

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(CodeSnakeContribution, LifecyclePhase.Restored);
