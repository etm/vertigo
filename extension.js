var APPLICATION_ICON_SIZE, Clutter, EXTENSION_NAME, Extension, ExtensionUtils, GLib, GObject, Gio, Main, Meta, Shell, St, init,
  indexOf = [].indexOf;

EXTENSION_NAME = 'vertigo';

APPLICATION_TOP = 32;
APPLICATION_ICON_SIZE = 20;
APPLICATION_WIDTH_ADD = 21;

GObject = imports.gi.GObject;

St = imports.gi.St;

Gio = imports.gi.Gio;

GLib = imports.gi.GLib;

Meta = imports.gi.Meta;

Clutter = imports.gi.Clutter;

Shell = imports.gi.Shell;

ExtensionUtils = imports.misc.extensionUtils;

Main = imports.ui.main;

Extension = class Extension {
  constructor() {
    this.settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.vertigo');
  }

  enable() {
    this.me = ExtensionUtils.getCurrentExtension();
    this.meta = this.me.metadata;
    this.appSystem = Shell.AppSystem.get_default();
    this.monitor = Main.layoutManager.primaryMonitor;
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
    });
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
    });
    // non-transparent text and icons
    this.windowList.set_opacity_override(255);
    this.windowTracker = Shell.WindowTracker.get_default();
    (() => {
      var signal;
      signal = this.settings.connect('changed::panel-opacity', this.opacityChanged.bind(this));
      return this.windowPanel.connect('destroy', () => {
        return this.settings.disconnect(signal);
      });
    })();
    (() => {
      var signal = global.workspace_manager.connect_after('active-workspace-changed', this.add_workspace_windows.bind(this));
      return this.windowPanel.connect('destroy', () => {
        return global.workspace_manager.disconnect(signal);
      });
    })();
    (() => {
      var signal = this.windowTracker.connect_after('tracked-windows-changed', this.add_workspace_windows.bind(this));
      return this.windowPanel.connect('destroy', () => {
        return this.windowTracker.disconnect(signal);
      });
    })();
    (() => {
      var signal;
      signal = Main.layoutManager.connect('monitors-changed', () => {
        var ref2, ref3;
        this.monitor = Main.layoutManager.primaryMonitor;
        this.windowPanel.set_position(((ref2 = this.monitor) != null ? ref2.x : void 0) || 0, APPLICATION_TOP);
        this.windowPanel.set_height(((ref3 = this.monitor) != null ? ref3.height : void 0) || 1000);
        Main.layoutManager.removeChrome(this.windowPanel);
        return Main.layoutManager.addChrome(this.windowPanel, {
          affectsStruts: true,
          trackFullscreen: true
        });
      });
      return this.windowPanel.connect('destroy', () => {
        return Main.layoutManager.disconnect(signal);
      });
    })();
    this.windowPanel.add_child(this.windowList);
    Main.layoutManager.addChrome(this.windowPanel, {
      affectsStruts: true,
      trackFullscreen: true
    });
    this.add_workspace_windows();
    return this.opacityChanged();
  }

  sort_windows(w1, w2) {
  	return w1.get_id() - w2.get_id();
  }

  add_workspace_windows() {
    var button, i, j, k, len, len1, len2, metaWindow, ref, ref1, w, windowPresent, windowSaved, windowsPresent, workspace, workspaces, active_workspace, ret;
    workspaces = global.workspace_manager.get_n_workspaces()
    active_workspace = global.workspace_manager.get_active_workspace_index();
    workspace = global.workspace_manager.get_active_workspace();
    ref = this.windowList.get_children();
    for (i = 0, len = ref.length; i < len; i++) {
      button = ref[i];
      button.destroy();
    }
    for (let ws_index = 0; ws_index < workspaces; ++ws_index) {
      workspace = global.workspace_manager.get_workspace_by_index(ws_index);
      this.add_workspace(workspace,ws_index == active_workspace,ws_index);
      windowsPresent = [];
      ref1 = global.display.get_tab_list(Meta.TabList.NORMAL, workspace);
      for (j = 0, len1 = ref1.length; j < len1; j++) {
        metaWindow = ref1[j];
        windowPresent = {
          order: metaWindow.get_stable_sequence(),
          metaWindow: metaWindow
        };
        windowsPresent.push(windowPresent);
      }
      windowsPresent.sort(function(a, b) {
        return 0 + (a.order >= b.order) - (a.order <= b.order);
      });
      for (k = 0, len2 = windowsPresent.length; k < len2; k++) {
        w = windowsPresent[k];
        this.add_window(workspace, w.metaWindow, ws_index);
      }
    }
    return;
  }

  showSettings() {
    return GLib.spawn_command_line_async('gnome-extensions prefs ' + this.meta.uuid);
  }

  opacityChanged() {
    return this.windowPanel.set_opacity(this.settings.get_int('panel-opacity'));
  }

  add_workspace(workspace, active, ws_index) {
    var box;
    box = new St.Bin({
      style_class: 'workspace-button',
      can_focus: true,
      x_expand: true,
      x_align: Clutter.ActorAlign.FILL,
      min_width: APPLICATION_ICON_SIZE + APPLICATION_WIDTH_ADD,
      reactive: true,
      layout_manager: new Clutter.BoxLayout({
        orientation: Clutter.Orientation.HORIZONTAL
      })
    });
    box.wsIndex = ws_index;


    var label = new St.Label({x_expand: true, x_align: Clutter.ActorAlign.FILL});

    if (active) {
      label.style_class = 'workspace-active';
    } else {
      label.style_class = 'workspace-inactive';
    }
    label.set_text((ws_index + 1).toString());
    box.set_child(label);
    this.windowList.add_child(box);

    (() => {
      var signal;
      signal = box.connect('button-release-event', this.buttonClicked.bind(this));
      return box.connect('destroy', () => {
        return box.disconnect(signal);
      });
    })();
  }

  add_window(workspace, metaWindow, ws_index) {
    var button, texture_cache;
    if (indexOf.call(global.display.get_tab_list(Meta.TabList.NORMAL, workspace), metaWindow) < 0) {
      return;
    }
    this.remove_window(workspace, metaWindow);
    button = new St.Widget({
      style_class: 'window-button',
      can_focus: true,
      track_hover: true,
      x_expand: true,
      x_align: Clutter.ActorAlign.FILL,
      reactive: true,
      layout_manager: new Clutter.BoxLayout({
        orientation: Clutter.Orientation.HORIZONTAL
      })
    });
    button.metaWindow = metaWindow;
    button.wsIndex = ws_index;
    button.icon = new St.Bin({ x_expand: false });
    button.add_child(button.icon);
    this.windowList.add_child(button);
    this.update_icon(metaWindow, button);

    (() => {
      var signal;
      signal = button.connect('button-release-event', this.buttonClicked.bind(this));
      return button.connect('destroy', () => {
        return button.disconnect(signal);
      });
    })();
    texture_cache = St.TextureCache.get_default();
    (() => {
      var signal;
      signal = texture_cache.connect_after('icon-theme-changed', this.update_icon.bind(this, metaWindow, button));
      return button.connect('destroy', () => {
        return texture_cache.disconnect(signal);
      });
    })();
    (() => {
      var signal;
      signal = metaWindow.connect_after('notify::wm-class', this.update_icon.bind(this, metaWindow, button));
      return button.connect('destroy', () => {
        return metaWindow.disconnect(signal);
      });
    })();
    (() => {
      var signal;
      signal = this.appSystem.connect('app-state-changed', this.update_icon.bind(this, metaWindow, button));
      return button.connect('destroy', () => {
        return this.appSystem.disconnect(signal);
      });
    })();
    (() => {
      var signal;
      signal = metaWindow.connect_after('notify::gtk-application-id', this.update_icon.bind(this, metaWindow, button));
      return button.connect('destroy', () => {
        return metaWindow.disconnect(signal);
      });
    })();
      return (() => {
      var signal;
      signal = global.display.connect('notify::focus-window', this.focus_window.bind(this, button));
      return button.connect('destroy', () => {
        return global.display.disconnect(signal);
      });
    })();
  }

  remove_window(workspace, metaWindow) {
    var button, i, len, ref, results;
    ref = this.windowList.get_children();
    results = [];
    for (i = 0, len = ref.length; i < len; i++) {
      button = ref[i];
      if (button.metaWindow === metaWindow) {
        results.push(button.destroy());
      } else {
        results.push(void 0);
      }
    }
    return results;
  }

  focus_window(button) {
    if (global.display.focus_window === button.metaWindow) {
      return button.add_style_class_name('focused');
    } else {
      return button.remove_style_class_name('focused');
    }
  }

  app(metaWindow) {
    return this.windowTracker.get_window_app(metaWindow);
  }

  update_icon(metaWindow, button) {
    var app, base;
    app = this.app(metaWindow);
    if (app) {
      return button.icon.child = app.create_icon_texture(APPLICATION_ICON_SIZE);
    } else {
      return (base = button.icon).child != null ? base.child : base.child = new St.Icon({
        icon_name: 'icon-missing',
        icon_size: APPLICATION_ICON_SIZE
      });
    }
  }

  buttonClicked(button, event) {
    var button_number = event.get_button();
    var metaWindow = button.metaWindow;
    if (metaWindow) {
      if (button_number === 1) {
        if (!metaWindow.appears_focused) {
          this.activate_window(metaWindow);
        }
        if (!metaWindow.is_on_all_workspaces()) {
          global.workspace_manager.get_workspace_by_index(button.wsIndex).activate(global.get_current_time());
        }
        return Clutter.EVENT_STOP;
      }
    } else {
      global.workspace_manager.get_workspace_by_index(button.wsIndex).activate(global.get_current_time());
    }
  }

  activate_window(metaWindow) {
    metaWindow.activate(global.get_current_time());
  }

  disable() {
    this.windowPanel.destroy();
    return this.windowPanel = null;
  }

};

init = function() {
  return new Extension();
};
