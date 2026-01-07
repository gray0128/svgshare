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
        /* Inject Chinese Handwriting Font (Xiaolai) */
        @import url('https://cdn.jsdelivr.net/npm/@chinese-fonts/xiaolai/dist/Xiaolai/result.min.css');

        /* Force Excalidraw SVGs to use the imported font */
        .excalidraw-svg text, 
        .excalidraw-svg tspan {
            font-family: 'Xiaolai SC', 'Xiaolai', sans-serif !important;
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
            max-width: 90%;
            max-height: 90%;
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
            }
        } catch (e) {
            this.container.innerHTML = '<span style="color:red">Error loading SVG</span>';
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
