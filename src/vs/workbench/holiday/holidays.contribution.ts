/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/holidays.css';
import { $, append, scheduleAtNextAnimationFrame } from '../../base/browser/dom.js';
import { Event } from '../../base/common/event.js';
import { DomEmitter } from '../../base/browser/event.js';
import { IDisposable, toDisposable, dispose, Disposable } from '../../base/common/lifecycle.js';
import { registerAction2, Action2, MenuId } from '../../platform/actions/common/actions.js';
import { IThemeService } from '../../platform/theme/common/themeService.js';
import { ServicesAccessor, IInstantiationService } from '../../platform/instantiation/common/instantiation.js';
import { localize, localize2 } from '../../nls.js';
import { Registry } from '../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from '../../platform/configuration/common/configurationRegistry.js';
import { IConfigurationService } from '../../platform/configuration/common/configuration.js';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../common/contributions.js';
import { LifecyclePhase } from '../services/lifecycle/common/lifecycle.js';

function animate(drawFn: () => void): IDisposable {
	let disposed = false;
	let scheduled = Disposable.None;

	const fn = () => {
		if (!disposed) {
			drawFn();
			scheduled = scheduleAtNextAnimationFrame(window, fn);
		}
	};

	fn();

	return toDisposable(() => {
		scheduled.dispose();
		disposed = true;
	});
}

function makeItSnow(canvas: HTMLCanvasElement, dark: boolean): IDisposable {
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		return Disposable.None;
	}

	const flakes: Array<{
		x: number;
		y: number;
		vx: number;
		vy: number;
		size: number;
		color: number;
	}> = [];

	function update() {
		const spawnCount = Math.ceil(Math.max(200 - flakes.length, 10) * Math.random() * 0.0005);

		for (let i = 0; i < spawnCount; i++) {
			const distance = Math.random();

			flakes.push({
				x: Math.random() * (canvas.width + 180 /* for wind */),
				y: -5,
				vx: (-(0.5 * distance)) * window.devicePixelRatio,
				vy: (0.2 + 1.5 * distance) * window.devicePixelRatio,
				size: (2 + 2 * distance) * window.devicePixelRatio,
				color: dark ? (170 + distance * 50) : (200 - distance * 50)
			});
		}

		for (let i = 0; i < flakes.length; i++) {
			const flake = flakes[i];
			flake.x += flake.vx;
			flake.y += flake.vy;

			if (flake.y > canvas.height) {
				flakes.splice(i--, 1);
			}
		}
	}

	function draw() {
		if (!ctx) return;

		ctx.clearRect(0, 0, canvas.width, canvas.height);

		for (const flake of flakes) {
			ctx.beginPath();
			ctx.arc(flake.x, flake.y, flake.size, 0, 2 * Math.PI);
			ctx.fillStyle = `rgba(${flake.color}, ${flake.color}, ${flake.color}, 1)`;
			ctx.fill();
		}
	}

	return animate(() => {
		update();
		draw();
	});
}

function makeEditorSnow(canvas: HTMLCanvasElement, dark: boolean, intensity: number = 1.0): IDisposable {
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		return Disposable.None;
	}

	const flakes: Array<{
		x: number;
		y: number;
		vx: number;
		vy: number;
		size: number;
		color: number;
	}> = [];

	function update() {
		const baseSpawnRate = 0.0005;
		const maxFlakes = Math.floor(200 * intensity);
		const spawnCount = Math.ceil(Math.max(maxFlakes - flakes.length, 10) * Math.random() * baseSpawnRate * intensity);

		for (let i = 0; i < spawnCount; i++) {
			const distance = Math.random();

			flakes.push({
				x: Math.random() * (canvas.width + 180 /* for wind */),
				y: -5,
				vx: (-(0.5 * distance)) * window.devicePixelRatio,
				vy: (0.2 + 1.5 * distance) * window.devicePixelRatio,
				size: (2 + 2 * distance) * window.devicePixelRatio,
				color: dark ? (170 + distance * 50) : (200 - distance * 50)
			});
		}

		for (let i = 0; i < flakes.length; i++) {
			const flake = flakes[i];
			flake.x += flake.vx;
			flake.y += flake.vy;

			if (flake.y > canvas.height) {
				flakes.splice(i--, 1);
			}
		}
	}

	function draw() {
		if (!ctx) return;

		ctx.clearRect(0, 0, canvas.width, canvas.height);

		for (const flake of flakes) {
			ctx.beginPath();
			ctx.arc(flake.x, flake.y, flake.size, 0, 2 * Math.PI);
			ctx.fillStyle = `rgba(${flake.color}, ${flake.color}, ${flake.color}, 1)`;
			ctx.fill();
		}
	}

	return animate(() => {
		update();
		draw();
	});
}

class HappyHolidaysAction extends Action2 {

	static readonly ID = 'workbench.action.happyHolidays';

	constructor() {
		super({
			id: HappyHolidaysAction.ID,
			title: localize2('happyHolidays', 'Happy Holidays!'),
			category: localize2('help', 'Help'),
			f1: true,
			menu: {
				id: MenuId.CommandPalette
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const themeService = accessor.get(IThemeService);
		const disposables: IDisposable[] = [];

		const workbench = document.querySelector('.monaco-workbench') as HTMLElement;
		if (workbench) {
			workbench.classList.add('blur');
			disposables.push(toDisposable(() => workbench.classList.remove('blur')));
		}

		const el = append(document.body, $('.happy-holidays'));
		disposables.push(toDisposable(() => {
			if (el.parentNode) {
				el.parentNode.removeChild(el);
			}
		}));

		const canvas: HTMLCanvasElement = append(el, $('canvas.happy-holidays-snow'));
		canvas.width = document.body.clientWidth * window.devicePixelRatio;
		canvas.height = document.body.clientHeight * window.devicePixelRatio;
		canvas.style.width = `${document.body.clientWidth}px`;
		canvas.style.height = `${document.body.clientHeight}px`;

		const isDark = themeService.getColorTheme().type !== 'light';
		disposables.push(makeItSnow(canvas, isDark));

		const text = append(el, $('.happy-holidays-text'));
		text.innerText = localize('holidayMessage', 'The VS Code team wishes you a great Holiday season!');
		setTimeout(() => text.classList.add('animate'), 50);

		const onKeyDown = new DomEmitter(document.body, 'keydown', true);
		const onClick = new DomEmitter(document.body, 'click', true);
		disposables.push(onKeyDown, onClick);
		const onInteraction = Event.any<any>(onKeyDown.event, onClick.event);

		const close = () => dispose(disposables);
		const onResize = new DomEmitter(window, 'resize');
		disposables.push(onResize);
		Event.once(onResize.event)(close, null, disposables);
		Event.once(onInteraction)(close, null, disposables);
	}
}

class HolidayManager extends Disposable {
	private styleElement: HTMLStyleElement | undefined;
	private snowCanvas: HTMLCanvasElement | undefined;
	private snowDisposable: IDisposable | undefined;

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IThemeService private readonly themeService: IThemeService
	) {
		super();
		this.updateHatVisibility();
		this.updateSnowVisibility();
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('weencode.holidays.turnOffHat')) {
				this.updateHatVisibility();
			}
			if (e.affectsConfiguration('weencode.holidays.enableSnow')) {
				this.updateSnowVisibility();
			}
			if (e.affectsConfiguration('weencode.holidays.snowIntensity')) {
				this.updateSnowIntensity();
			}
		}));
	}

	private updateHatVisibility(): void {
		const turnOffHat = this.configurationService.getValue<boolean>('weencode.holidays.turnOffHat');

		if (turnOffHat) {
			this.hideHat();
		} else {
			this.showHat();
		}
	}

	private updateSnowVisibility(): void {
		const enableSnow = this.configurationService.getValue<boolean>('weencode.holidays.enableSnow');

		if (enableSnow) {
			this.showSnow();
		} else {
			this.hideSnow();
		}
	}

	private updateSnowIntensity(): void {
		const enableSnow = this.configurationService.getValue<boolean>('weencode.holidays.enableSnow');
		if (enableSnow && this.snowCanvas) {
			this.hideSnow();
			this.showSnow();
		}
	}

	private showHat(): void {
		if (this.styleElement) {
			this.styleElement.remove();
			this.styleElement = undefined;
		}
	}

	private hideHat(): void {
		if (!this.styleElement) {
			this.styleElement = document.createElement('style');
			this.styleElement.textContent = `
				.codicon-settings-view-bar-icon::after {
					display: none !important;
				}
			`;
			document.head.appendChild(this.styleElement);
		}
	}

	private showSnow(): void {
		if (this.snowCanvas) {
			return;
		}

		const enableSnow = this.configurationService.getValue<boolean>('weencode.holidays.enableSnow');
		if (!enableSnow) {
			return;
		}

		this.snowCanvas = document.createElement('canvas');
		this.snowCanvas.className = 'holiday-snow-overlay';
		this.snowCanvas.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			pointer-events: none;
			z-index: 1000;
		`;

		this.snowCanvas.width = window.innerWidth * window.devicePixelRatio;
		this.snowCanvas.height = window.innerHeight * window.devicePixelRatio;
		this.snowCanvas.style.width = `${window.innerWidth}px`;
		this.snowCanvas.style.height = `${window.innerHeight}px`;

		document.body.appendChild(this.snowCanvas);

		const isDark = this.themeService.getColorTheme().type !== 'light';
		const intensity = this.configurationService.getValue<number>('weencode.holidays.snowIntensity') || 1.0;
		this.snowDisposable = makeEditorSnow(this.snowCanvas, isDark, intensity);

		const resizeHandler = () => {
			if (this.snowCanvas) {
				this.snowCanvas.width = window.innerWidth * window.devicePixelRatio;
				this.snowCanvas.height = window.innerHeight * window.devicePixelRatio;
				this.snowCanvas.style.width = `${window.innerWidth}px`;
				this.snowCanvas.style.height = `${window.innerHeight}px`;
			}
		};
		window.addEventListener('resize', resizeHandler);
		this._register(toDisposable(() => window.removeEventListener('resize', resizeHandler)));
	}

	private hideSnow(): void {
		if (this.snowDisposable) {
			this.snowDisposable.dispose();
			this.snowDisposable = undefined;
		}
		if (this.snowCanvas) {
			this.snowCanvas.remove();
			this.snowCanvas = undefined;
		}
	}

	override dispose(): void {
		if (this.styleElement) {
			this.styleElement.remove();
			this.styleElement = undefined;
		}
		this.hideSnow();
		super.dispose();
	}
}

registerAction2(HappyHolidaysAction);

const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
	id: 'weencode',
	order: 2,
	title: localize('weencodeConfigurationTitle', 'weencode'),
	type: 'object',
	properties: {
		'weencode.holidays.turnOffHat': {
			type: 'boolean',
			default: false,
			description: localize('holidaysTurnOffHat', 'un jolly your editor')
		},
		'weencode.holidays.enableSnow': {
			type: 'boolean',
			default: false,
			description: localize('holidaysEnableSnow', 'make it snow!')
		},
		'weencode.holidays.snowIntensity': {
			type: 'number',
			default: 1.0,
			minimum: 0.1,
			maximum: 3.0,
			description: localize('holidaysSnowIntensity', 'snow intensity (0.1 = light, 1.0 = normal, 3.0 = blizzard)')
		}
	}
});

class HolidayHatContribution extends Disposable {
	constructor(
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super();
		this._register(instantiationService.createInstance(HolidayManager));
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(HolidayHatContribution, LifecyclePhase.Restored);
