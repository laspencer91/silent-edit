const blessed = require("blessed");

/**
 * OverlayHost manages modal overlays rendered on top of the editor UI.
 * Components that wish to display as overlays should implement the
 * following optional interface:
 *   - attach(parent): append renderables to provided parent container
 *   - detach(): remove renderables used by the overlay
 *   - onShow(): lifecycle hook invoked when the overlay becomes visible
 *   - onHide(): lifecycle hook invoked before the overlay is hidden
 *   - focus(): set focus to the overlay's primary interactive element
 */
class OverlayHost {
  constructor(screen) {
    this.screen = screen;
    this.activeComponent = null;

    this.layer = blessed.box({
      parent: screen,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      tags: true,
      hidden: true,
      style: {
        bg: null,
      },
    });

    this.backdrop = blessed.box({
      parent: this.layer,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      tags: false,
      hidden: true,
      style: {
        bg: "black",
      },
      transparent: true,
    });
  }

  isActive() {
    return Boolean(this.activeComponent);
  }

  async show(component) {
    if (!component) return;

    if (this.activeComponent && this.activeComponent !== component) {
      this.hide();
    }

    if (!this.activeComponent) {
      this.activeComponent = component;

      if (component.attach) {
        component.attach(this.layer);
      }

      this.layer.show();
      this.backdrop.show();
      this.layer.setFront();

      if (typeof component.onShow === "function") {
        try {
          const maybePromise = component.onShow();
          if (maybePromise && typeof maybePromise.then === "function") {
            await maybePromise.catch(() => {});
          }
        } catch (err) {
          // Overlay lifecycle errors should not crash the editor.
        }
      }

      if (typeof component.focus === "function") {
        component.focus();
      }

      this.screen.render();

      // If the component supports promise-based interaction, return its result
      if (typeof component.getResult === "function") {
        try {
          const result = await component.getResult();
          this.hide();
          return result;
        } catch (err) {
          this.hide();
          throw err;
        }
      }
    }
  }

  hide() {
    if (!this.activeComponent) return;

    const component = this.activeComponent;
    this.activeComponent = null;

    if (typeof component.onHide === "function") {
      try {
        component.onHide();
      } catch (err) {
        // Suppress overlay shutdown errors to keep the editor stable.
      }
    }

    if (typeof component.detach === "function") {
      component.detach();
    }

    this.backdrop.hide();
    this.layer.hide();
    this.screen.render();
  }
}

module.exports = { OverlayHost };
