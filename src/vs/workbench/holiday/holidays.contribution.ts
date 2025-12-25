/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/holidays';
import { $, append, addClass, removeClass, scheduleAtNextAnimationFrame } from '../../../../base/browser/dom.js';
import { Event } from '../../../../base/common/event.js';
import { domEvent, stop } from '../../../../base/browser/event.js';
import { IDisposable, toDisposable, dispose, Disposable } from '../../../../base/common/lifecycle.js';
import { registerAction2, Action2, MenuId } from '../../../../platform/actions/common/actions.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { localize, localize2 } from '../../../../nls.js';

function animate(drawFn: () => void): IDisposable {
	let disposed = false;
	let scheduled = Disposable.None;

	const fn = () => {
		if (!disposed) {
			drawFn();
			scheduled = scheduleAtNextAnimationFrame(fn);
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
			addClass(workbench, 'blur');
			disposables.push(toDisposable(() => removeClass(workbench, 'blur')));
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
		setTimeout(() => addClass(text, 'animate'), 50);

		const onKeyDown = domEvent(document.body, 'keydown', true);
		const onClick = domEvent(document.body, 'click', true);
		const onInteraction = Event.any<any>(onKeyDown, onClick);

		const close = () => dispose(disposables);
		Event.once(domEvent(window, 'resize'))(close, null, disposables);
		stop(Event.once(onInteraction))(close, null, disposables);
	}
}

registerAction2(HappyHolidaysAction);
