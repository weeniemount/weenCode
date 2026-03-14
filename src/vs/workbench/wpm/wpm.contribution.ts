import { Disposable, MutableDisposable } from '../../base/common/lifecycle.js';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../common/contributions.js';
import { Registry } from '../../platform/registry/common/platform.js';
import { LifecyclePhase } from '../services/lifecycle/common/lifecycle.js';
import { IStatusbarEntryAccessor, IStatusbarService, StatusbarAlignment } from '../services/statusbar/browser/statusbar.js';
import { IConfigurationService } from '../../platform/configuration/common/configuration.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from '../../platform/configuration/common/configurationRegistry.js';
import { ICodeEditorService } from '../../editor/browser/services/codeEditorService.js';
import { IEditorService } from '../services/editor/common/editorService.js';
import { localize } from '../../nls.js';

class WpmContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.wpm';

	private readonly statusBarEntry = this._register(new MutableDisposable<IStatusbarEntryAccessor>());
	private readonly editorListener = this._register(new MutableDisposable());
	private sessionStart: number | null = null;
	private totalCharsTyped = 0;

	constructor(
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ICodeEditorService private readonly codeEditorService: ICodeEditorService,
		@IEditorService private readonly editorService: IEditorService,
	) {
		super();
		this.updateVisibility();
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('weencode.wpm')) {
				this.updateVisibility();
			}
		}));
		this._register(this.codeEditorService.onCodeEditorAdd(() => this.attachEditorListener()));
		this._register(this.codeEditorService.onCodeEditorRemove(() => this.attachEditorListener()));
	}

	private updateVisibility(): void {
		const enabled = this.configurationService.getValue<boolean>('weencode.wpm');
		if (enabled) {
			this.enable();
		} else {
			this.disable();
		}
	}

	private enable(): void {
		this.attachEditorListener();
		this._register(this.editorService.onDidActiveEditorChange(() => {
			this.resetSession();
			this.attachEditorListener();
		}));
		this.updateStatusBar();
	}

	private disable(): void {
		this.editorListener.clear();
		this.statusBarEntry.clear();
		this.sessionStart = null;
		this.totalCharsTyped = 0;
	}

	private attachEditorListener(): void {
		this.editorListener.clear();
		const editor = this.codeEditorService.getActiveCodeEditor();
		if (!editor) {
			return;
		}
		this.editorListener.value = editor.onDidChangeModelContent(e => {
			let charsAdded = 0;
			for (const change of e.changes) {
				charsAdded += change.text.length;
				if (change.text.includes('\n')) {
					const resetOnNewline = this.configurationService.getValue<boolean>('weencode.wpmResetOnNewline');
					if (resetOnNewline) {
						this.resetSession();
						return;
					}
				}
			}
			if (charsAdded === 0) {
				return;
			}
			if (this.sessionStart === null) {
				this.sessionStart = Date.now();
			}
			this.totalCharsTyped += charsAdded;
			this.updateStatusBar();
		});
	}

	private resetSession(): void {
		this.sessionStart = null;
		this.totalCharsTyped = 0;
		this.updateStatusBar();
	}

	private updateStatusBar(): void {
		let wpm = 0;
		if (this.sessionStart !== null && this.totalCharsTyped > 0) {
			const elapsedMinutes = (Date.now() - this.sessionStart) / 60_000;
			if (elapsedMinutes > 0) {
				wpm = Math.round((this.totalCharsTyped / 5) / elapsedMinutes);
			}
		}

		const text = `$(keyboard) ${wpm} WPM`;
		const tooltip = localize('wpmTooltip', 'typing speed: {0} WPM', wpm);

		if (!this.statusBarEntry.value) {
			this.statusBarEntry.value = this.statusbarService.addEntry(
				{ name: localize('wpmLabel', 'WPM'), text, tooltip, ariaLabel: text },
				'status.wpm',
				StatusbarAlignment.RIGHT,
				101
			);
		} else {
			this.statusBarEntry.value.update({ name: localize('wpmLabel', 'WPM'), text, tooltip, ariaLabel: text });
		}
	}

	override dispose(): void {
		this.disable();
		super.dispose();
	}
}

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration)
	.registerConfiguration({
		id: 'weencode',
		order: 1,
		title: localize('weencodeConfigurationTitle', 'Weencode'),
		type: 'object',
		properties: {
			'weencode.wpm': {
				type: 'boolean',
				default: false,
				description: localize('weencodeWpm', 'show typing speed (WPM) in the status bar')
			},
			'weencode.wpmResetOnNewline': {
				type: 'boolean',
				default: true,
				description: localize('weencodeWpmResetOnNewline', 'reset WPM counter when you press Enter')
			}
		}
	});

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(WpmContribution, LifecyclePhase.Restored);
