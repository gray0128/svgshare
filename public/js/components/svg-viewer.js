class SvgViewer extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.scale = 1;
        this.panning = false;
        this.pointX = 0;
        this.pointY = 0;
        this.start = { x: 0, y: 0 };
    }

    static get observedAttributes() { return ['src']; }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'src' && newValue) {
            this.loadSvg(newValue);
        }
    }

    connectedCallback() {
        this.render();
        this.addEventListeners();
    }

    render() {
        this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: relative;
          width: 100%;
          height: 100%;
          background: var(--bg-secondary, #1a1a1a);
          overflow: hidden;
          cursor: grab;
        }
        :host(:active) {
            cursor: grabbing;
        }
        .container {
           width: 100%;
           height: 100%;
           display: flex;
           align-items: center;
           justify-content: center;
           transform-origin: center;
        }
        svg {
            width: 100%;
            height: 100%;
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            pointer-events: none; /* Let clicks pass to container for panning */
        }
        .controls {
            position: fixed;
            bottom: 20px;
            right: 20px;
            display: flex;
            gap: 8px;
            background: rgba(0,0,0,0.7);
            padding: 8px;
            border-radius: 8px;
            backdrop-filter: blur(4px);
            z-index: 10000;
        }
        button {
            background: rgba(255,255,255,0.1);
            border: none;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
        }
        button:hover {
            background: rgba(255,255,255,0.2);
        }
      </style>
      <div class="container" id="container">
        <!-- SVG injected here -->
        <span style="color: grey">Loading...</span>
      </div>
      <div class="controls">
        <button id="zoomOut">-</button>
        <button id="reset" title="Reset View">↺</button>
        <button id="zoomIn">+</button>
      </div>
    `;

        this.container = this.shadowRoot.getElementById('container');
    }

    async loadSvg(url) {
        if (!this.container) return;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Load failed');
            const text = await response.text();

            // Security clean up (simple regex)
            // Ideally use DOMParser and sanitizer
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'image/svg+xml');
            const svg = doc.querySelector('svg');

            if (svg) {
                // Remove scripts
                const scripts = svg.querySelectorAll('script');
                scripts.forEach(s => s.remove());
                // Remove on* handlers
                const all = svg.querySelectorAll('*');
                all.forEach(el => {
                    for (const attr of el.attributes) {
                        if (attr.name.startsWith('on')) {
                            el.removeAttribute(attr.name);
                        }
                    }
                });

                this.container.innerHTML = '';
                this.container.appendChild(svg);

                // Auto-fit the SVG content after rendering
                requestAnimationFrame(() => {
                    this.autoFitContent(svg);
                });
            }
        } catch (e) {
            this.container.innerHTML = '<span style="color:red">Error loading SVG</span>';
        }
    }

    /**
     * Auto-fit the SVG content by adjusting viewBox to match actual content bounds.
     * This fixes issues where SVG content is offset from origin or has incorrect viewBox.
     */
    autoFitContent(svg) {
        try {
            // Get the actual bounding box of the SVG content
            const bbox = svg.getBBox();

            // Skip if bbox is invalid (empty SVG)
            if (bbox.width === 0 || bbox.height === 0) return;

            // Add some padding around the content (5% on each side)
            const padding = Math.max(bbox.width, bbox.height) * 0.05;
            const newViewBox = `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`;

            // Store original viewBox for reference
            this.originalViewBox = svg.getAttribute('viewBox');

            // Set the new viewBox that encompasses all content
            svg.setAttribute('viewBox', newViewBox);

            // Ensure SVG fills the container properly
            svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

            // Remove fixed width/height if present to allow responsive sizing
            if (svg.hasAttribute('width')) {
                this.originalWidth = svg.getAttribute('width');
                svg.removeAttribute('width');
            }
            if (svg.hasAttribute('height')) {
                this.originalHeight = svg.getAttribute('height');
                svg.removeAttribute('height');
            }

            // Reset transform state for fresh view
            this.scale = 1;
            this.pointX = 0;
            this.pointY = 0;
            this.updateTransform();

        } catch (e) {
            // getBBox may fail in some edge cases, silently ignore
            console.warn('Auto-fit failed:', e);
        }
    }

    addEventListeners() {
        // Zoom Controls
        this.shadowRoot.getElementById('zoomIn').onclick = () => this.zoom(1.2);
        this.shadowRoot.getElementById('zoomOut').onclick = () => this.zoom(0.8);
        this.shadowRoot.getElementById('reset').onclick = () => this.reset();

        // Pan Logic
        this.onmousedown = (e) => {
            this.panning = true;
            this.start = { x: e.clientX - this.pointX, y: e.clientY - this.pointY };
        };

        this.onmouseup = () => { this.panning = false; };
        this.onmouseleave = () => { this.panning = false; };

        this.onmousemove = (e) => {
            if (!this.panning) return;
            e.preventDefault();
            this.pointX = e.clientX - this.start.x;
            this.pointY = e.clientY - this.start.y;
            this.updateTransform();
        };

        // Wheel Zoom
        this.onwheel = (e) => {
            e.preventDefault();
            const xs = (e.clientX - this.pointX) / this.scale;
            const ys = (e.clientY - this.pointY) / this.scale;
            const delta = -e.deltaY;

            (delta > 0) ? (this.scale *= 1.03) : (this.scale /= 1.03);

            this.pointX = e.clientX - xs * this.scale;
            this.pointY = e.clientY - ys * this.scale;

            this.updateTransform();
        }
    }

    zoom(factor) {
        this.scale *= factor;
        this.updateTransform();
    }

    reset() {
        this.scale = 1;
        this.pointX = 0;
        this.pointY = 0;
        this.updateTransform();
    }

    updateTransform() {
        this.container.style.transform = `translate(${this.pointX}px, ${this.pointY}px) scale(${this.scale})`;
    }
}

customElements.define('svg-viewer', SvgViewer);
