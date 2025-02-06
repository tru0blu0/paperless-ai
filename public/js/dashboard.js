//public/js/dashboard.js:

// Theme Management
class ThemeManager {
    constructor() {
        this.themeToggle = document.getElementById('themeToggle');
        this.initialize();
    }

    initialize() {
        // Load saved theme or default to light
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme);

        // Add event listener for theme toggle
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => this.toggleTheme());
        }
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);

        // Update toggle button icon
        const icon = this.themeToggle?.querySelector('i');
        if (icon) {
            icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }
}

// Chart Initialization
class ChartManager {
    constructor() {
        this.initializeDocumentChart();
    }

    initializeDocumentChart() {
        const documentChart = document.getElementById('documentChart');
        if (!documentChart) {
            console.warn('documentChart element not found, skipping chart initialization.');
            return;
        }

        const { documentCount, processedDocumentCount } = window.dashboardData || { documentCount: 0, processedDocumentCount: 0 };
        const unprocessedCount = documentCount - processedDocumentCount;

        try {
            const ctx = documentChart.getContext('2d');
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['AI Processed', 'Unprocessed'],
                    datasets: [{
                        data: [processedDocumentCount, unprocessedCount],
                        backgroundColor: [
                            '#3b82f6',  // blue-500
                            '#e2e8f0'   // gray-200
                        ],
                        borderWidth: 0,
                        spacing: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    const value = context.raw;
                                    const total = documentCount;
                                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                    return `${value} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error initializing document chart:', error);
        }
    }
}

// Modal Management
class ModalManager {
    constructor() {
        this.modal = document.getElementById('detailsModal');
        if(!this.modal) return;
        this.modalTitle = this.modal.querySelector('.modal-title');
        this.modalContent = this.modal.querySelector('.modal-data');
        this.modalLoader = this.modal.querySelector('.modal-loader');
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        if(!this.modal) return;
        // Close button click
        this.modal.querySelector('.modal-close').addEventListener('click', () => this.hideModal());

        // Overlay click
        this.modal.querySelector('.modal-overlay').addEventListener('click', () => this.hideModal());

        // Escape key press
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('show')) {
                this.hideModal();
            }
        });
    }

    showModal(title) {
        if(!this.modal) return;
        this.modalTitle.textContent = title;
        this.modalContent.innerHTML = '';
        this.modal.classList.remove('hidden'); // Fix: Remove 'hidden' class
        this.modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    hideModal() {
        if(!this.modal) return;
        this.modal.classList.remove('show');
        this.modal.classList.add('hidden'); // Fix: Add 'hidden' class back
        document.body.style.overflow = '';
    }

    showLoader() {
        if(!this.modal) return;
        this.modalLoader.classList.remove('hidden');
        this.modalContent.classList.add('hidden');
    }

    hideLoader() {
        if(!this.modal) return;
        this.modalLoader.classList.add('hidden');
        this.modalContent.classList.remove('hidden');
    }

    setContent(content) {
        if(!this.modal) return;
        this.modalContent.innerHTML = content;
    }
}

//Navigation Manager
class NavigationManager {
    constructor() {
        this.sidebarLinks = document.querySelectorAll('.sidebar-link');
        this.initialize();
    }

    initialize() {
        this.sidebarLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                // Only for Links without a real target call preventDefault
                if (link.getAttribute('href') === '#') {
                    e.preventDefault();
                }
                this.setActiveLink(link);
            });
        });
    }

    setActiveLink(activeLink) {
        this.sidebarLinks.forEach(link => {
            link.classList.remove('active');
        });
        activeLink.classList.add('active');
    }
}

// Make showTagDetails and showCorrespondentDetails globally available
window.showTagDetails = async function () {
    if (!window.modalManager) return;

    window.modalManager.showModal('Tag Overview');
    window.modalManager.showLoader();

    try {
        const response = await fetch('/api/tagsCount');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const tags = await response.json();

        let content = '<div class="detail-list">';
        tags.forEach(tag => {
            content += `
                <div class="detail-item">
                    <span class="detail-item-name">${tag.name}</span>
                    <span class="detail-item-info">${tag.document_count || 0} documents</span>
                </div>
            `;
        });
        content += '</div>';

        window.modalManager.setContent(content);
    } catch (error) {
        console.error('Error loading tags:', error);
        window.modalManager.setContent('<div class="text-red-500 p-4">Error loading tags. Please try again later.</div>');
    } finally {
        window.modalManager.hideLoader();
    }
}

window.showCorrespondentDetails = async function () {
    if (!window.modalManager) return;
    
    window.modalManager.showModal('Correspondent Overview');
    window.modalManager.showLoader();

    try {
        const response = await fetch('/api/correspondentsCount');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const correspondents = await response.json();

        let content = '<div class="detail-list">';
        correspondents.forEach(correspondent => {
            content += `
                <div class="detail-item">
                    <span class="detail-item-name">${correspondent.name}</span>
                    <span class="detail-item-info">${correspondent.document_count || 0} documents</span>
                </div>
            `;
        });
        content += '</div>';

        window.modalManager.setContent(content);
    } catch (error) {
        console.error('Error loading correspondents:', error);
        window.modalManager.setContent('<div class="text-red-500 p-4">Error loading correspondents. Please try again later.</div>');
    } finally {
        window.modalManager.hideLoader();
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
    window.navigationManager = new NavigationManager();
    window.chartManager = new ChartManager();
    window.modalManager = new ModalManager(); //This might be skipped if elements are not loaded
});
