import { observable, action } from "mobx";
import { remote } from 'electron';
import { JSObject } from "../components/Log";
import { i18next } from '../locale/i18n';
import { isMojave, isWin, isMac, defaultFolder } from '../utils/platform';

const { systemPreferences } = remote;

const APP_STORAGE_KEY = 'react-explorer';

const TERMINAL_CMD = {
    'darwin': 'open -a "%cmd" "%path"',
    'win': 'start /D "%path" "%cd%" "%cmd"',
    'linux': 'cd "%path" && "%cmd"'
};
const DEFAULT_TERMINAL = {
    'darwin': 'Terminal.app',
    'win': 'C:\\Windows\\System32\\cmd.exe',
    'linux': 'xterm'
};

export class SettingsState {
    @observable
    lang: string;

    @observable
    // this is the asked mode
    darkMode: boolean | 'auto';

    // this is the current active mode
    @observable
    isDarkModeActive: boolean;

    @observable
    defaultFolder: string;

    @observable
    defaultTerminal: string;

    terminalTemplate: string;

    version: string;

    constructor(version: string) {
        this.version = version;

        this.installListeners();
        this.loadSettings();
    }

    installListeners() {
        // systemPreferences may not be defined if running outside of Electron
        if (isMojave && systemPreferences) {
            systemPreferences.subscribeNotification(
                'AppleInterfaceThemeChangedNotification',
                () => this.setActiveTheme()
            );
        }
    }

    getParam(name: string): JSObject {
        return JSON.parse(localStorage.getItem(name));
    }

    @action
    setLanguage(askedLang: string) {
        let lang = askedLang;

        // detect language from host OS if set to auto
        if (lang === 'auto') {
            lang = remote.app.getLocale();
        }

        // Note: it seems i18next may not always
        // have cached all languages, even though it will correctly work.
        // Comment this out for now since it prevents locale other than English
        // from working
        // if (i18next.languages.indexOf(lang) < 0) {
        //     lang = 'en';
        // }

        // finally set requested language
        i18next.changeLanguage(lang);

        console.log('setting language to', i18next.language);

        this.lang = i18next.language;
    }

    @action
    setDefaultTerminal(cmd: string) {
        this.defaultTerminal = cmd;
        let template = TERMINAL_CMD.linux;

        if (isWin) {
            template = TERMINAL_CMD.win;
        } else if (isMac) {
            template = TERMINAL_CMD.darwin
        }

        this.terminalTemplate = template.replace('%cmd', cmd.replace(/"/g, '\\"'));
    }

    getTerminalCommand(path: string) {
        return this.terminalTemplate.replace('%path', path.replace(/"/g, '\\"'));
    }

    saveSettings() {
        localStorage.setItem(APP_STORAGE_KEY, JSON.stringify({
            lang: this.lang,
            defaultFolder: this.defaultFolder,
            darkMode: this.darkMode,
            defaultTerminal: this.defaultTerminal,
            version: this.version
        }));
    }

    @action
    loadAndUpgradeSettings(): JSObject {
        let settings = this.getParam(APP_STORAGE_KEY);
        // no settings set: first time the app is run
        if (settings === null) {
            settings = this.getDefaultSettings();
        } else if (!settings.version || settings.version < this.version) {
            // get default settings
            const defaultSettings = this.getDefaultSettings();
            // override default settings with current settings
            settings = Object.assign(defaultSettings, settings);
        }

        return settings;
    }

    @action
    loadSettings(): void {
        let settings: JSObject;

        settings = this.loadAndUpgradeSettings();

        this.darkMode = settings.darkMode;

        this.setActiveTheme();
        this.setLanguage(settings.lang);
        this.setDefaultFolder(settings.defaultFolder);
        this.setDefaultTerminal(settings.defaultTerminal);

        // we should only save settings in case it's the first time the app is run
        // or an upgrade was needed
        this.saveSettings();
    }

    @action
    setDefaultFolder(folder: string) {
        this.defaultFolder = folder;
    }

    @action
    setActiveTheme = (darkMode = this.darkMode) => {
        if (darkMode !== this.darkMode) {
            this.darkMode = darkMode;
        }

        if (this.darkMode === 'auto') {
            this.isDarkModeActive = (isMojave && systemPreferences) ? systemPreferences.isDarkMode() : false;
        } else {
            this.isDarkModeActive = this.darkMode;
        }
    }

    getDefaultSettings() {
        return {
            lang: 'auto',
            darkMode: isMojave ? 'auto' : false,
            defaultFolder: defaultFolder,
            defaultTerminal: isMac ? DEFAULT_TERMINAL.darwin : isWin && DEFAULT_TERMINAL.win || DEFAULT_TERMINAL.linux,
            version: this.version
        }
    }

    @action
    resetSettings() {
        localStorage.removeItem(APP_STORAGE_KEY);
        this.loadSettings();
    }
}
