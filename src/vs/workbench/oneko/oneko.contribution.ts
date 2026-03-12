import './media/oneko.css';
import { IDisposable, toDisposable, Disposable } from '../../base/common/lifecycle.js';
import { IConfigurationService } from '../../platform/configuration/common/configuration.js';
import { Registry } from '../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from '../../platform/configuration/common/configurationRegistry.js';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../common/contributions.js';
import { LifecyclePhase } from '../services/lifecycle/common/lifecycle.js';
import { localize } from '../../nls.js';

class OnekoManager extends Disposable {
	private nekoEl: HTMLDivElement | undefined;
	private animationDisposable: IDisposable | undefined;
	private nekoPosX = 32;
	private nekoPosY = 32;
	private mousePosX = 0;
	private mousePosY = 0;
	private frameCount = 0;
	private idleTime = 0;
	private idleAnimation: string | null = null;
	private idleAnimationFrame = 0;
	private readonly nekoSpeed = 10;

	private readonly spriteSets = {
		idle: [[-3, -3]],
		alert: [[-7, -3]],
		scratchSelf: [[-5, 0], [-6, 0], [-7, 0]],
		scratchWallN: [[0, 0], [0, -1]],
		scratchWallS: [[-7, -1], [-6, -2]],
		scratchWallE: [[-2, -2], [-2, -3]],
		scratchWallW: [[-4, 0], [-4, -1]],
		tired: [[-3, -2]],
		sleeping: [[-2, 0], [-2, -1]],
		N: [[-1, -2], [-1, -3]],
		NE: [[0, -2], [0, -3]],
		E: [[-3, 0], [-3, -1]],
		SE: [[-5, -1], [-5, -2]],
		S: [[-6, -3], [-7, -2]],
		SW: [[-5, -3], [-6, -1]],
		W: [[-4, -2], [-4, -3]],
		NW: [[-1, 0], [-1, -1]]
	};

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService
	) {
		super();
		this.updateOnekoVisibility();
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('weencode.oneko')) {
				this.updateOnekoVisibility();
			}
		}));
	}
	private updateOnekoVisibility(): void {
		const enabled = this.configurationService.getValue<boolean>('weencode.oneko');

		if (enabled) {
			this.showOneko();
		} else {
			this.hideOneko();
		}
	}

	private showOneko(): void {
		if (this.nekoEl) {
			return;
		}

		console.log('Oneko: Attempting to show cat');

		const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (isReducedMotion) {
			console.log('Oneko: Reduced motion detected, not showing cat');
			return;
		}

		console.log('Oneko: Creating cat element');

		this.loadPersistedPosition();

		this.nekoEl = document.createElement('div');
		this.nekoEl.id = 'oneko';
		this.nekoEl.setAttribute('aria-hidden', 'true');
		this.nekoEl.style.width = '32px';
		this.nekoEl.style.height = '32px';
		this.nekoEl.style.position = 'fixed';
		this.nekoEl.style.pointerEvents = 'none';
		this.nekoEl.style.imageRendering = 'pixelated';
		this.nekoEl.style.left = `${this.nekoPosX - 16}px`;
		this.nekoEl.style.top = `${this.nekoPosY - 16}px`;
		this.nekoEl.style.zIndex = '2147483647';
		this.nekoEl.style.backgroundImage = 'url("data:image/gif;base64,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")';

		document.body.appendChild(this.nekoEl);

		const mouseMoveHandler = (event: MouseEvent) => {
			this.mousePosX = event.clientX;
			this.mousePosY = event.clientY;
		};
		document.addEventListener('mousemove', mouseMoveHandler);

		const beforeUnloadHandler = () => {
			this.persistPosition();
		};
		window.addEventListener('beforeunload', beforeUnloadHandler);

		this.animationDisposable = this.startAnimation();

		this._register(toDisposable(() => {
			document.removeEventListener('mousemove', mouseMoveHandler);
			window.removeEventListener('beforeunload', beforeUnloadHandler);
		}));
	}
	private hideOneko(): void {
		if (this.animationDisposable) {
			this.animationDisposable.dispose();
			this.animationDisposable = undefined;
		}
		if (this.nekoEl) {
			this.nekoEl.remove();
			this.nekoEl = undefined;
		}
	}

	private loadPersistedPosition(): void {
		try {
			const storedNeko = window.localStorage.getItem('oneko');
			if (storedNeko) {
				const data = JSON.parse(storedNeko);
				this.nekoPosX = data.nekoPosX || 32;
				this.nekoPosY = data.nekoPosY || 32;
				this.mousePosX = data.mousePosX || 0;
				this.mousePosY = data.mousePosY || 0;
				this.frameCount = data.frameCount || 0;
				this.idleTime = data.idleTime || 0;
				this.idleAnimation = data.idleAnimation || null;
				this.idleAnimationFrame = data.idleAnimationFrame || 0;
			}
		} catch (e) {
			return;
		}
	}

	private persistPosition(): void {
		try {
			window.localStorage.setItem('oneko', JSON.stringify({
				nekoPosX: this.nekoPosX,
				nekoPosY: this.nekoPosY,
				mousePosX: this.mousePosX,
				mousePosY: this.mousePosY,
				frameCount: this.frameCount,
				idleTime: this.idleTime,
				idleAnimation: this.idleAnimation,
				idleAnimationFrame: this.idleAnimationFrame,
				bgPos: this.nekoEl?.style.backgroundPosition || ''
			}));
		} catch (e) {
			return;
		}
	}

	private startAnimation(): IDisposable {
		let lastFrameTimestamp = 0;
		let animationId: number;

		const onAnimationFrame = (timestamp: number) => {
			if (!this.nekoEl?.isConnected) {
				return;
			}

			if (!lastFrameTimestamp) {
				lastFrameTimestamp = timestamp;
			}

			if (timestamp - lastFrameTimestamp > 100) {
				lastFrameTimestamp = timestamp;
				this.frame();
			}

			animationId = requestAnimationFrame(onAnimationFrame);
		};

		animationId = requestAnimationFrame(onAnimationFrame);

		return toDisposable(() => {
			if (animationId) {
				cancelAnimationFrame(animationId);
			}
		});
	}
	private setSprite(name: string, frame: number): void {
		if (!this.nekoEl) return;

		const spriteSet = this.spriteSets[name as keyof typeof this.spriteSets];
		if (!spriteSet) return;

		const sprite = spriteSet[frame % spriteSet.length];
		this.nekoEl.style.backgroundPosition = `${sprite[0] * 32}px ${sprite[1] * 32}px`;
	}

	private resetIdleAnimation(): void {
		this.idleAnimation = null;
		this.idleAnimationFrame = 0;
	}

	private idle(): void {
		this.idleTime += 1;

		if (this.idleTime > 10 && Math.floor(Math.random() * 200) === 0 && this.idleAnimation === null) {
			const availableIdleAnimations = ['sleeping', 'scratchSelf'];

			if (this.nekoPosX < 32) {
				availableIdleAnimations.push('scratchWallW');
			}
			if (this.nekoPosY < 32) {
				availableIdleAnimations.push('scratchWallN');
			}
			if (this.nekoPosX > window.innerWidth - 32) {
				availableIdleAnimations.push('scratchWallE');
			}
			if (this.nekoPosY > window.innerHeight - 32) {
				availableIdleAnimations.push('scratchWallS');
			}

			this.idleAnimation = availableIdleAnimations[Math.floor(Math.random() * availableIdleAnimations.length)];
		}

		switch (this.idleAnimation) {
			case 'sleeping':
				if (this.idleAnimationFrame < 8) {
					this.setSprite('tired', 0);
					break;
				}
				this.setSprite('sleeping', Math.floor(this.idleAnimationFrame / 4));
				if (this.idleAnimationFrame > 192) {
					this.resetIdleAnimation();
				}
				break;
			case 'scratchWallN':
			case 'scratchWallS':
			case 'scratchWallE':
			case 'scratchWallW':
			case 'scratchSelf':
				this.setSprite(this.idleAnimation, this.idleAnimationFrame);
				if (this.idleAnimationFrame > 9) {
					this.resetIdleAnimation();
				}
				break;
			default:
				this.setSprite('idle', 0);
				return;
		}

		this.idleAnimationFrame += 1;
	}
	private frame(): void {
		if (!this.nekoEl) return;

		this.frameCount += 1;
		const diffX = this.nekoPosX - this.mousePosX;
		const diffY = this.nekoPosY - this.mousePosY;
		const distance = Math.sqrt(diffX ** 2 + diffY ** 2);

		if (distance < this.nekoSpeed || distance < 48) {
			this.idle();
			return;
		}

		this.idleAnimation = null;
		this.idleAnimationFrame = 0;

		if (this.idleTime > 1) {
			this.setSprite('alert', 0);
			this.idleTime = Math.min(this.idleTime, 7);
			this.idleTime -= 1;
			return;
		}

		let direction = '';
		direction += diffY / distance > 0.5 ? 'N' : '';
		direction += diffY / distance < -0.5 ? 'S' : '';
		direction += diffX / distance > 0.5 ? 'W' : '';
		direction += diffX / distance < -0.5 ? 'E' : '';

		this.setSprite(direction, this.frameCount);

		this.nekoPosX -= (diffX / distance) * this.nekoSpeed;
		this.nekoPosY -= (diffY / distance) * this.nekoSpeed;

		this.nekoPosX = Math.min(Math.max(16, this.nekoPosX), window.innerWidth - 16);
		this.nekoPosY = Math.min(Math.max(16, this.nekoPosY), window.innerHeight - 16);

		this.nekoEl.style.left = `${this.nekoPosX - 16}px`;
		this.nekoEl.style.top = `${this.nekoPosY - 16}px`;
	}

	override dispose(): void {
		this.hideOneko();
		super.dispose();
	}
}

const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
	id: 'weencode',
	order: 1,
	title: localize('weencodeConfigurationTitle', 'Weencode'),
	type: 'object',
	properties: {
		'weencode.oneko': {
			type: 'boolean',
			default: false,
			description: localize('weencodeOneko', 'cat follow mouse (real)')
		},
		'weencode.physics': {
			type: 'boolean',
			default: false,
			description: localize('weencodePhysics', 'turn on physics (makes UI elements fall and bounce)')
		}
	}
});

class OnekoContribution extends Disposable {
	constructor(
		@IConfigurationService configurationService: IConfigurationService
	) {
		super();
		this._register(new OnekoManager(configurationService));
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(OnekoContribution, LifecyclePhase.Restored);
