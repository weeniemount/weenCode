import { Disposable } from '../../base/common/lifecycle.js';
import { IWorkbenchContribution } from '../common/contributions.js';
import { IConfigurationService } from '../../platform/configuration/common/configuration.js';
import { getActiveWindow } from '../../base/browser/dom.js';

class PhysicsContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.physics';

	private physicsElements: Array<{
		element: HTMLElement;
		x: number;
		y: number;
		vx: number;
		vy: number;
		rotation: number;
		vr: number;
		isDragging?: boolean;
		dragOffsetX?: number;
		dragOffsetY?: number;
		lastMouseX?: number;
		lastMouseY?: number;
		dragStartTime?: number;
		dragStartX?: number;
		dragStartY?: number;
	}> = [];
	private animationFrame: number | null = null;
	private enabled = false;
	private draggedElement: any = null;
	private domObserver: MutationObserver | null = null;
	private settingsObserver: MutationObserver | null = null;
	private physicsWasEnabled = false;

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService
	) {
		super();

		this.updatePhysicsState();
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('weencode.physics')) {
				this.updatePhysicsState();
			}
		}));

		this.startSettingsObserver();
	}

	private updatePhysicsState(): void {
		const enabled = this.configurationService.getValue<boolean>('weencode.physics');

		if (enabled && !this.enabled) {
			this.enablePhysics();
		} else if (!enabled && this.enabled) {
			this.disablePhysics();
		}
	}

	private enablePhysics(): void {
		const win = getActiveWindow();
		const doc = win.document;
		const settingsEditor = doc.querySelector('.settings-editor, .preferences-editor');
		if (settingsEditor) {
			this.physicsWasEnabled = true;
			return;
		}

		this.enabled = true;

		const selectors = [
			'.monaco-button',
			'.monaco-inputbox',
			'.monaco-select-box',
			'.monaco-list-row',
			'.monaco-icon-label',
			'.action-label',
			'.menubar-menu-button',
			'.tabs-container .tab',
			'.part.statusbar .statusbar-item',
			'.context-view',
			'.monaco-editor'
		];

		selectors.forEach(selector => {
			const elements = doc.querySelectorAll(selector);
			elements.forEach((el) => {
				if (el instanceof HTMLElement && !el.classList.contains('physics-enabled')) {
					if (el.closest('.settings-editor') || el.closest('.preferences-editor')) {
						return;
					}
					this.makeElementPhysical(el);
				}
			});
		});

		this.startDOMObserver();
		this.startPhysicsLoop();
	}

	private makeElementPhysical(element: HTMLElement): void {
		element.classList.add('physics-enabled');

		const rect = element.getBoundingClientRect();
		const win = getActiveWindow();

		const originalPosition = element.style.position;
		const originalTop = element.style.top;
		const originalLeft = element.style.left;

		element.style.position = 'fixed';
		element.style.zIndex = '9999';
		element.style.cursor = 'grab';

		const physicsObj = {
			element,
			x: rect.left,
			y: rect.top,
			vx: (Math.random() - 0.5) * 5,
			vy: Math.random() * -10 - 5,
			rotation: 0,
			vr: (Math.random() - 0.5) * 10,
			isDragging: false,
			dragOffsetX: 0,
			dragOffsetY: 0,
			lastMouseX: 0,
			lastMouseY: 0,
			dragStartTime: 0,
			dragStartX: 0,
			dragStartY: 0
		};

		this.physicsElements.push(physicsObj);

		(element as any)._originalStyles = {
			position: originalPosition,
			top: originalTop,
			left: originalLeft,
			transform: element.style.transform,
			zIndex: element.style.zIndex,
			cursor: element.style.cursor,
			pointerEvents: element.style.pointerEvents
		};

		let dragTimeout: any = null;
		let hasMoved = false;

		const onMouseDown = (e: MouseEvent) => {
			hasMoved = false;
			physicsObj.dragStartX = e.clientX;
			physicsObj.dragStartY = e.clientY;
			physicsObj.lastMouseX = e.clientX;
			physicsObj.lastMouseY = e.clientY;
			physicsObj.dragStartTime = Date.now();

			dragTimeout = setTimeout(() => {
				if (!hasMoved) {
					startDrag(e);
				}
			}, 150);

			const onMove = (moveEvent: MouseEvent) => {
				const dx = moveEvent.clientX - physicsObj.dragStartX!;
				const dy = moveEvent.clientY - physicsObj.dragStartY!;
				const distance = Math.sqrt(dx * dx + dy * dy);

				if (distance > 5) {
					hasMoved = true;
					if (dragTimeout) {
						clearTimeout(dragTimeout);
						dragTimeout = null;
					}
					if (!physicsObj.isDragging) {
						startDrag(moveEvent);
					}
				}
			};

			const onUp = () => {
				if (dragTimeout) {
					clearTimeout(dragTimeout);
					dragTimeout = null;
				}
				win.removeEventListener('mousemove', onMove);
				win.removeEventListener('mouseup', onUp);

				if (!hasMoved && !physicsObj.isDragging) {
				}
			};

			win.addEventListener('mousemove', onMove);
			win.addEventListener('mouseup', onUp);
		};

		const startDrag = (e: MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			physicsObj.isDragging = true;
			physicsObj.dragOffsetX = e.clientX - physicsObj.x;
			physicsObj.dragOffsetY = e.clientY - physicsObj.y;
			physicsObj.lastMouseX = e.clientX;
			physicsObj.lastMouseY = e.clientY;
			physicsObj.vx = 0;
			physicsObj.vy = 0;
			physicsObj.vr = 0;
			element.style.cursor = 'grabbing';
			this.draggedElement = physicsObj;
		};

		element.addEventListener('mousedown', onMouseDown);
		(element as any)._physicsMouseDown = onMouseDown;
	}

	private startPhysicsLoop(): void {
		if (this.animationFrame !== null) {
			return;
		}

		const win = getActiveWindow();
		const gravity = 0.5;
		const bounce = 0.7;
		const friction = 0.99;

		const onMouseMove = (e: MouseEvent) => {
			if (this.draggedElement && this.draggedElement.isDragging) {
				const newX = e.clientX - this.draggedElement.dragOffsetX;
				const newY = e.clientY - this.draggedElement.dragOffsetY;

				const dx = newX - this.draggedElement.x;
				const dy = newY - this.draggedElement.y;

				this.draggedElement.x = newX;
				this.draggedElement.y = newY;

				this.draggedElement.vx = dx * 0.8;
				this.draggedElement.vy = dy * 0.8;

				this.draggedElement.lastMouseX = e.clientX;
				this.draggedElement.lastMouseY = e.clientY;
			}
		};

		const onMouseUp = () => {
			if (this.draggedElement) {
				this.draggedElement.isDragging = false;
				this.draggedElement.element.style.cursor = 'grab';

				this.draggedElement.vr = this.draggedElement.vx * 0.5;

				this.draggedElement = null;
			}
		};

		win.addEventListener('mousemove', onMouseMove);
		win.addEventListener('mouseup', onMouseUp);

		(this as any)._physicsMouseMove = onMouseMove;
		(this as any)._physicsMouseUp = onMouseUp;

		const animate = () => {
			if (!this.enabled) {
				return;
			}

			this.physicsElements.forEach(obj => {
				if (obj.isDragging) {
					obj.element.style.left = `${obj.x}px`;
					obj.element.style.top = `${obj.y}px`;
					return;
				}

				obj.vy += gravity;

				obj.vx *= friction;

				obj.x += obj.vx;
				obj.y += obj.vy;
				obj.rotation += obj.vr;

				if (obj.y + obj.element.offsetHeight > win.innerHeight) {
					obj.y = win.innerHeight - obj.element.offsetHeight;
					obj.vy *= -bounce;
					obj.vr *= 0.8;

					if (Math.abs(obj.vy) < 1) {
						obj.vy = 0;
						obj.vr *= 0.5;
					}
				}

				if (obj.x < 0) {
					obj.x = 0;
					obj.vx *= -bounce;
				} else if (obj.x + obj.element.offsetWidth > win.innerWidth) {
					obj.x = win.innerWidth - obj.element.offsetWidth;
					obj.vx *= -bounce;
				}

				obj.element.style.left = `${obj.x}px`;
				obj.element.style.top = `${obj.y}px`;
				obj.element.style.transform = `rotate(${obj.rotation}deg)`;
			});

			this.animationFrame = win.requestAnimationFrame(animate);
		};

		animate();
	}

	private disablePhysics(): void {
		this.enabled = false;

		const win = getActiveWindow();

		if (this.animationFrame !== null) {
			win.cancelAnimationFrame(this.animationFrame);
			this.animationFrame = null;
		}

		if (this.domObserver) {
			this.domObserver.disconnect();
			this.domObserver = null;
		}

		if ((this as any)._physicsMouseMove) {
			win.removeEventListener('mousemove', (this as any)._physicsMouseMove);
			delete (this as any)._physicsMouseMove;
		}
		if ((this as any)._physicsMouseUp) {
			win.removeEventListener('mouseup', (this as any)._physicsMouseUp);
			delete (this as any)._physicsMouseUp;
		}

		this.physicsElements.forEach(obj => {
			obj.element.classList.remove('physics-enabled');

			if ((obj.element as any)._physicsMouseDown) {
				obj.element.removeEventListener('mousedown', (obj.element as any)._physicsMouseDown);
				delete (obj.element as any)._physicsMouseDown;
			}

			const original = (obj.element as any)._originalStyles;
			if (original) {
				obj.element.style.position = original.position;
				obj.element.style.top = original.top;
				obj.element.style.left = original.left;
				obj.element.style.transform = original.transform;
				obj.element.style.zIndex = original.zIndex;
				obj.element.style.cursor = original.cursor;
				obj.element.style.pointerEvents = original.pointerEvents;
				delete (obj.element as any)._originalStyles;
			}
		});

		this.physicsElements = [];
		this.draggedElement = null;
	}

	override dispose(): void {
		this.disablePhysics();
		if (this.settingsObserver) {
			this.settingsObserver.disconnect();
			this.settingsObserver = null;
		}
		super.dispose();
	}

	private startSettingsObserver(): void {
		const win = getActiveWindow();
		const doc = win.document;

		const checkSettings = () => {
			const settingsEditor = doc.querySelector('.settings-editor, .preferences-editor');

			if (settingsEditor && this.enabled) {
				this.physicsWasEnabled = true;
				this.disablePhysics();
			} else if (!settingsEditor && this.physicsWasEnabled && !this.enabled) {
				this.physicsWasEnabled = false;
				const shouldBeEnabled = this.configurationService.getValue<boolean>('weencode.physics');
				if (shouldBeEnabled) {
					this.enablePhysics();
				}
			}
		};

		this.settingsObserver = new MutationObserver(() => {
			checkSettings();
		});

		this.settingsObserver.observe(doc.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['class']
		});

		checkSettings();
	}

	private startDOMObserver(): void {
		const win = getActiveWindow();
		const doc = win.document;

		this.domObserver = new MutationObserver((mutations) => {
			if (!this.enabled) {
				return;
			}

			mutations.forEach((mutation) => {
				mutation.addedNodes.forEach((node) => {
					if (node instanceof HTMLElement) {
						if (node.classList.contains('context-view') || node.classList.contains('monaco-menu-container')) {
							if (!node.classList.contains('physics-enabled')) {
								this.makeElementPhysical(node);
							}
						}

						if (node.classList.contains('monaco-editor')) {
							if (!node.classList.contains('physics-enabled')) {
								this.makeElementPhysical(node);
							}
						}

						const contextViews = node.querySelectorAll('.context-view, .monaco-menu-container');
						contextViews.forEach((el) => {
							if (el instanceof HTMLElement && !el.classList.contains('physics-enabled')) {
								this.makeElementPhysical(el);
							}
						});

						const editors = node.querySelectorAll('.monaco-editor');
						editors.forEach((el) => {
							if (el instanceof HTMLElement && !el.classList.contains('physics-enabled')) {
								this.makeElementPhysical(el);
							}
						});
					}
				});
			});
		});

		this.domObserver.observe(doc.body, {
			childList: true,
			subtree: true
		});
	}
}

import { Registry } from '../../platform/registry/common/platform.js';
import { Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry } from '../common/contributions.js';
import { LifecyclePhase } from '../services/lifecycle/common/lifecycle.js';

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(PhysicsContribution, LifecyclePhase.Restored);
