var EXTENSION_NAME = 'vertigo'

var APPLICATION_TOP = 32
var APPLICATION_ICON_SIZE = 20
var APPLICATION_WIDTH_ADD = 21

var GObject = imports.gi.GObject
var St = imports.gi.St
var GLib = imports.gi.GLib
var Meta = imports.gi.Meta
var Clutter = imports.gi.Clutter
var Shell = imports.gi.Shell
var ExtensionUtils = imports.misc.extensionUtils
var Main = imports.ui.main

var  indexOf = [].indexOf

Extension = class Extension {
  constructor() {
    this.settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.vertigo')
  }

  enable() {
    this.me = ExtensionUtils.getCurrentExtension()
    this.meta = this.me.metadata
    this.appSystem = Shell.AppSystem.get_default()
    this.monitor = Main.layoutManager.primaryMonitor
    this.windowPanel = new St.Widget({
      style_class: 'windows-panel',
      reactive: true,
      track_hover: false,
      visible: true,
      layout_manager: new Clutter.BoxLayout({
        orientation: Clutter.Orientation.VERTICAL
      }),
      height: (this.monitor != null ? this.monitor.height - APPLICATION_TOP : void 0) || 1000,
      x: (this.monitor != null ? this.monitor.width - (APPLICATION_ICON_SIZE + APPLICATION_WIDTH_ADD) : void 0) || 0,
      y: APPLICATION_TOP
    })
    this.windowList = new St.Widget({
      style_class: 'windows-list',
      reactive: true,
      layout_manager: new Clutter.BoxLayout({
        homogeneous: true,
        orientation: Clutter.Orientation.VERTICAL
      }),
      y_align: Clutter.ActorAlign.START,
      x_expand: false,
      y_expand: true
    })
    this.windowList.set_opacity_override(255)
    this.windowTracker = Shell.WindowTracker.get_default()

    ;(() => {
      let signal = this.settings.connect('changed::panel-opacity', this.opacityChanged.bind(this))
      return this.windowPanel.connect('destroy', () => {
        return this.settings.disconnect(signal)
      })
    })()
    ;(() => {
      let signal = global.workspace_manager.connect_after('active-workspace-changed', this.add_workspace_windows.bind(this))
      return this.windowPanel.connect('destroy', () => {
        return global.workspace_manager.disconnect(signal)
      })
    })()
    ;(() => {
      let signal = this.windowTracker.connect_after('tracked-windows-changed', this.add_workspace_windows.bind(this))
      return this.windowPanel.connect('destroy', () => {
        return this.windowTracker.disconnect(signal)
      })
    })()
    ;(() => {
      let signal = Main.layoutManager.connect('monitors-changed', () => {
        this.windowPanel.set_position((this.monitor != null ? this.monitor.x : void 0) || 0, APPLICATION_TOP)
        this.windowPanel.set_height((this.monitor != null ? this.monitor.height : void 0) || 1000)
        Main.layoutManager.removeChrome(this.windowPanel)
        return Main.layoutManager.addChrome(this.windowPanel, {
          affectsStruts: true,
          trackFullscreen: true
        })
      })
      return this.windowPanel.connect('destroy', () => {
        return Main.layoutManager.disconnect(signal)
      })
    })()
    this.windowPanel.add_child(this.windowList)
    Main.layoutManager.addChrome(this.windowPanel, {
      affectsStruts: true,
      trackFullscreen: true
    })
    this.add_workspace_windows()
  }

  add_workspace_windows() {
    this.windowList.get_children().forEach(w => w.destroy())

    let active_workspace = global.workspace_manager.get_active_workspace_index()
    for (let ws_index = 0; ws_index < global.workspace_manager.get_n_workspaces(); ++ws_index) {
      let workspace = global.workspace_manager.get_workspace_by_index(ws_index)
      this.add_workspace(workspace,ws_index == active_workspace,ws_index)
      let windows = global.display.get_tab_list(Meta.TabList.NORMAL, workspace).map(metaWindow => {
        return {
          order: metaWindow.get_stable_sequence(),
          metaWindow: metaWindow
        }
      })
      windows.sort((a, b) => {
        return 0 + (a.order >= b.order) - (a.order <= b.order)
      })
      windows.forEach(w => this.add_window(workspace, w.metaWindow, ws_index))
    }
  }

  showSettings() {
    return GLib.spawn_command_line_async('gnome-extensions prefs ' + this.meta.uuid)
  }

  opacityChanged() {
    return this.windowPanel.set_opacity(this.settings.get_int('panel-opacity'))
  }

  add_workspace(workspace, active, ws_index) {
    let box = new St.Bin({
      style_class: 'workspace-button',
      can_focus: true,
      x_expand: true,
      x_align: Clutter.ActorAlign.FILL,
      min_width: APPLICATION_ICON_SIZE + APPLICATION_WIDTH_ADD,
      reactive: true,
      layout_manager: new Clutter.BoxLayout({
        orientation: Clutter.Orientation.HORIZONTAL
      })
    })
    box.wsIndex = ws_index

    let label = new St.Label({x_expand: true, x_align: Clutter.ActorAlign.FILL})
    if (active) {
      label.style_class = 'workspace-active'
    } else {
      label.style_class = 'workspace-inactive'
    }
    label.set_text((ws_index + 1).toString())
    box.set_child(label)
    this.windowList.add_child(box)

    ;(() => {
      let signal = box.connect('button-release-event', this.buttonClicked.bind(this))
      box.connect('destroy', () => {
        box.disconnect(signal)
      })
    })()
  }

  add_window(workspace, metaWindow, ws_index) {
    if (indexOf.call(global.display.get_tab_list(Meta.TabList.NORMAL, workspace), metaWindow) < 0) {
      return
    }
    let button = new St.Widget({
      style_class: 'window-button',
      can_focus: true,
      track_hover: true,
      x_expand: true,
      x_align: Clutter.ActorAlign.FILL,
      reactive: true,
      layout_manager: new Clutter.BoxLayout({
        orientation: Clutter.Orientation.HORIZONTAL
      })
    })
    button.metaWindow = metaWindow
    button.wsIndex = ws_index
    button.icon = new St.Bin({ x_expand: false })
    button.add_child(button.icon)
    this.windowList.add_child(button)
    this.update_icon(metaWindow, button)

    ;(() => {
      let signal = button.connect('button-release-event', this.buttonClicked.bind(this))
      button.connect('destroy', () => button.disconnect(signal))
    })()
    ;(() => {
      let texture_cache = St.TextureCache.get_default()
      let signal = texture_cache.connect_after('icon-theme-changed', this.update_icon.bind(this, metaWindow, button))
      button.connect('destroy', () => texture_cache.disconnect(signal))
    })()
    ;(() => {
      let signal = metaWindow.connect_after('notify::wm-class', this.update_icon.bind(this, metaWindow, button))
      button.connect('destroy', () => metaWindow.disconnect(signal))
    })()
    ;(() => {
      let signal = this.appSystem.connect('app-state-changed', this.update_icon.bind(this, metaWindow, button))
      button.connect('destroy', () => this.appSystem.disconnect(signal))
    })()
    ;(() => {
      let signal = metaWindow.connect_after('notify::gtk-application-id', this.update_icon.bind(this, metaWindow, button))
      button.connect('destroy', () => metaWindow.disconnect(signal))
    })()
    ;(() => {
      let signal = global.display.connect('notify::focus-window', this.focus_window.bind(this, button))
      button.connect('destroy', () => global.display.disconnect(signal))
    })()
  }

  focus_window(button) {
    if (global.display.focus_window === button.metaWindow) {
      return button.add_style_class_name('focused')
    } else {
      return button.remove_style_class_name('focused')
    }
  }

  app(metaWindow) {
    return this.windowTracker.get_window_app(metaWindow)
  }

  update_icon(metaWindow, button) {
    let app = this.app(metaWindow)
    if (app) {
      button.icon.child = app.create_icon_texture(APPLICATION_ICON_SIZE)
    } else {
      if (button.icon.child == null) {
        button.icon.child = new St.Icon({
          icon_name: 'icon-missing',
          icon_size: APPLICATION_ICON_SIZE
        })
      }
    }
  }

  buttonClicked(button, event) {
    var button_number = event.get_button()
    var metaWindow = button.metaWindow
    if (metaWindow) {
      if (button_number === 1) {
        if (!metaWindow.appears_focused) {
          metaWindow.activate(global.get_current_time())
        }
        if (!metaWindow.is_on_all_workspaces()) {
          global.workspace_manager.get_workspace_by_index(button.wsIndex).activate(global.get_current_time())
        }
        return Clutter.EVENT_STOP
      }
    } else {
      global.workspace_manager.get_workspace_by_index(button.wsIndex).activate(global.get_current_time())
    }
  }

  disable() {
    this.windowPanel.destroy()
    return this.windowPanel = null
  }

}

var init = function() {
  return new Extension()
}
