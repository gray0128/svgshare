class BentoGrid extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
    }

    render() {
        this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          grid-auto-rows: 280px; /* Increased height for better thumbnail visibility */
          gap: 16px;
          padding: 20px;
          width: 100%;
          box-sizing: border-box;
        }

        /* Responsive Columns */
        @media (min-width: 768px) {
            :host {
                grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            }
        }
        
        ::slotted(*) {
            background: var(--bg-card);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-md);
            overflow: hidden;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        ::slotted(*:hover) {
            transform: translateY(-2px);
            box-shadow: 0 0 20px rgba(255, 51, 0, 0.1); /* Subtle Glow */
            border-color: var(--border-glow);
            z-index: 1;
        }
      </style>
      <slot></slot>
    `;
    }
}

customElements.define('bento-grid', BentoGrid);
