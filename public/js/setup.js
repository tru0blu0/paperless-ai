//pubic/js/setup.js:

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
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);

        // Update toggle button icon
        const icon = this.themeToggle.querySelector('i');
        icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }
}

class FormManager {
    constructor() {
        this.form = document.getElementById('setupForm');
        this.aiProvider = document.getElementById('aiProvider');
        this.showTags = document.getElementById('showTags');
        this.aiProcessedTag = document.getElementById('aiProcessedTag');
        this.usePromptTags = document.getElementById('usePromptTags');
        this.systemPrompt = document.getElementById('systemPrompt');
        this.systemPromptBtn = document.getElementById('systemPromptBtn');
        this.initialize();
    }

    initialize() {
        // Initialize provider settings
        this.toggleProviderSettings();

        // Initialize tags section
        this.toggleTagsInput();

        // Add event listeners
        this.aiProvider.addEventListener('change', () => this.toggleProviderSettings());
        this.showTags.addEventListener('change', () => this.toggleTagsInput());
        this.aiProcessedTag.addEventListener('change', () => this.toggleAiTagInput());
        this.usePromptTags.addEventListener('change', () => this.togglePromptTagsInput());

        // Initialize password toggles
        this.initializePasswordToggles();

        // Initial state for prompt elements based on usePromptTags
        if (this.usePromptTags && this.usePromptTags.value === 'yes') {
            this.disablePromptElements();
        }

        // Initialize new sections
        this.toggleAiTagInput();
        this.togglePromptTagsInput();
    }

    toggleProviderSettings() {
        const provider = this.aiProvider.value;
        const openaiSettings = document.getElementById('openaiSettings');
        const ollamaSettings = document.getElementById('ollamaSettings');
        const customSettings = document.getElementById('customSettings');

        // Get all required fields
        const openaiKey = document.getElementById('openaiKey');
        const ollamaUrl = document.getElementById('ollamaUrl');
        const ollamaModel = document.getElementById('ollamaModel');
        const customBaseUrl = document.getElementById('customBaseUrl');
        const customApiKey = document.getElementById('customApiKey');
        const customModel = document.getElementById('customModel');

        // Hide all settings first
        openaiSettings.style.display = 'none';
        ollamaSettings.style.display = 'none';
        customSettings.style.display = 'none';

        // Reset all required attributes
        if(openaiKey) openaiKey.required = false;
        if(ollamaUrl) ollamaUrl.required = false;
        if(ollamaModel) ollamaModel.required = false;
        if(customBaseUrl) customBaseUrl.required = false;
        if(customApiKey) customApiKey.required = false;
        if(customModel) customModel.required = false;

        // Show and set required fields based on selected provider
        switch (provider) {
            case 'openai':
                if(openaiSettings) openaiSettings.style.display = 'block';
                if(openaiKey) openaiKey.required = true;
                break;
            case 'ollama':
                if(ollamaSettings) ollamaSettings.style.display = 'block';
                if(ollamaUrl) ollamaUrl.required = true;
                if(ollamaModel) ollamaModel.required = true;
                break;
            case 'custom':
                if(customSettings) customSettings.style.display = 'block';
                if(customBaseUrl) customBaseUrl.required = true;
                if(customApiKey) customApiKey.required = true;
                if(customModel) customModel.required = true;
                break;
        }
    }

    toggleTagsInput() {
        const showTags = this.showTags.value;
        const tagsInputSection = document.getElementById('tagsInputSection');

        if (showTags === 'yes') {
            tagsInputSection.classList.remove('hidden');
        } else {
            tagsInputSection.classList.add('hidden');
        }
    }

    toggleAiTagInput() {
        const showAiTag = this.aiProcessedTag.value;
        const aiTagNameSection = document.getElementById('aiTagNameSection');

        if (showAiTag === 'yes') {
            aiTagNameSection.classList.remove('hidden');
        } else {
            aiTagNameSection.classList.add('hidden');
        }
    }

    togglePromptTagsInput() {
        const usePromptTags = this.usePromptTags.value;
        const promptTagsSection = document.getElementById('promptTagsSection');

        if (usePromptTags === 'yes') {
            promptTagsSection.classList.remove('hidden');
            this.disablePromptElements();
        } else {
            promptTagsSection.classList.add('hidden');
            this.enablePromptElements();
        }
    }

    disablePromptElements() {
        if(this.systemPrompt) this.systemPrompt.disabled = true;
        if(this.systemPromptBtn) this.systemPromptBtn.disabled = true;
        if(this.systemPrompt) this.systemPrompt.classList.add('disabled');
        if(this.systemPromptBtn) this.systemPromptBtn.classList.add('disabled');
    }

    enablePromptElements() {
        if(this.systemPrompt) this.systemPrompt.disabled = false;
        if(this.systemPromptBtn) this.systemPromptBtn.disabled = false;
        if(this.systemPrompt) this.systemPrompt.classList.remove('disabled');
        if(this.systemPromptBtn) this.systemPromptBtn.classList.remove('disabled');
    }

    initializePasswordToggles() {
        document.querySelectorAll('.password-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                const inputId = e.currentTarget.dataset.input;
                this.togglePassword(inputId);
            });
        });
    }

    togglePassword(inputId) {
        const input = document.getElementById(inputId);
        const icon = input.nextElementSibling.querySelector('i');

        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
}

// Tags Management
class TagsManager {
    constructor() {
        this.tagInput = document.getElementById('tagInput');
        this.tagsContainer = document.getElementById('tagsContainer');
        this.tagsHiddenInput = document.getElementById('tags');
        this.addTagButton = document.querySelector('.add-tag-btn');
        this.initialize();

        // Initialize existing tags with click handlers
        document.querySelectorAll('.modern-tag button').forEach(button => {
            button.addEventListener('click', async () => {
                const result = await Swal.fire({
                    title: 'Remove Tag',
                    text: 'Are you sure you want to remove this tag?',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Yes, remove it',
                    cancelButtonText: 'Cancel',
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#3085d6',
                    customClass: {
                        container: 'my-swal'
                    }
                });

                if (result.isConfirmed) {
                    button.closest('.modern-tag').remove();
                    this.updateHiddenInput();
                }
            });
        });
    }

    initialize() {
        // Add event listeners
        if(this.addTagButton) this.addTagButton.addEventListener('click', () => this.addTag());
        if(this.tagInput) this.tagInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addTag();
            }
        });
    }

    async addTag() {
        const tagText = this.tagInput.value.trim();
        const specialChars = /[,;:\n\r\\/]/;
        if (specialChars.test(tagText)) {
            await Swal.fire({
                title: 'Invalid Characters',
                text: 'Tags cannot contain commas, semi-colons, colons, or line breaks.',
                icon: 'warning',
                confirmButtonText: 'OK',
                confirmButtonColor: '#3085d6',
                customClass: {
                    container: 'my-swal'
                }
            });
            return;
        }
        if (tagText) {
            const tag = this.createTagElement(tagText);
            this.tagsContainer.appendChild(tag);
            this.updateHiddenInput();
            this.tagInput.value = '';
        }
    }

    createTagElement(text) {
        const tag = document.createElement('div');
        tag.className = 'modern-tag fade-in';

        const tagText = document.createElement('span');
        tagText.textContent = text;

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.innerHTML = '<i class="fas fa-times"></i>';
        removeButton.addEventListener('click', async () => {
            const result = await Swal.fire({
                title: 'Remove Tag',
                text: 'Are you sure you want to remove this tag?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Yes, remove it',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                customClass: {
                    container: 'my-swal'
                }
            });

            if (result.isConfirmed) {
                tag.remove();
                this.updateHiddenInput();
            }
        });

        tag.appendChild(tagText);
        tag.appendChild(removeButton);

        return tag;
    }

    updateHiddenInput() {
        const tags = Array.from(this.tagsContainer.children)
            .map(tag => tag.querySelector('span').textContent);
        this.tagsHiddenInput.value = tags.join(',');
    }
}

// Prompt Tags Management
class PromptTagsManager {
    constructor() {
        this.tagInput = document.getElementById('promptTagInput');
        this.tagsContainer = document.getElementById('promptTagsContainer');
        this.tagsHiddenInput = document.getElementById('promptTags');
        this.addTagButton = document.querySelector('.add-prompt-tag-btn');
        this.initialize();

        // Initialize existing tags with click handlers
        document.querySelectorAll('#promptTagsContainer .modern-tag button').forEach(button => {
            button.addEventListener('click', async () => {
                const result = await Swal.fire({
                    title: 'Remove Tag',
                    text: 'Are you sure you want to remove this tag?',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Yes, remove it',
                    cancelButtonText: 'Cancel',
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#3085d6',
                    customClass: {
                        container: 'my-swal'
                    }
                });

                if (result.isConfirmed) {
                    button.closest('.modern-tag').remove();
                    this.updateHiddenInput();
                }
            });
        });
    }

    initialize() {
        // Add event listeners
        if(this.addTagButton) this.addTagButton.addEventListener('click', () => this.addTag());
        if(this.tagInput) this.tagInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addTag();
            }
        });
    }

    async addTag() {
        const tagText = this.tagInput.value.trim();
        const specialChars = /[,;:\n\r\\/]/;
        if (specialChars.test(tagText)) {
            await Swal.fire({
                title: 'Invalid Characters',
                text: 'Tags cannot contain commas, semi-colons, colons, or line breaks.',
                icon: 'warning',
                confirmButtonText: 'OK',
                confirmButtonColor: '#3085d6',
                customClass: {
                    container: 'my-swal'
                }
            });
            return;
        }
        if (tagText) {
            const tag = this.createTagElement(tagText);
            this.tagsContainer.appendChild(tag);
            this.updateHiddenInput();
            this.tagInput.value = '';
        }
    }

    createTagElement(text) {
        const tag = document.createElement('div');
        tag.className = 'modern-tag fade-in';

        const tagText = document.createElement('span');
        tagText.textContent = text;

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.innerHTML = '<i class="fas fa-times"></i>';
        removeButton.addEventListener('click', async () => {
            const result = await Swal.fire({
                title: 'Remove Tag',
                text: 'Are you sure you want to remove this tag?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Yes, remove it',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                customClass: {
                    container: 'my-swal'
                }
            });

            if (result.isConfirmed) {
                tag.remove();
                this.updateHiddenInput();
            }
        });

        tag.appendChild(tagText);
        tag.appendChild(removeButton);

        return tag;
    }

    updateHiddenInput() {
        const tags = Array.from(this.tagsContainer.children)
            .map(tag => tag.querySelector('span').textContent);
        this.tagsHiddenInput.value = tags.join(',');
    }
}

// Prompt Management
class PromptManager {
    constructor() {
        this.systemPrompt = document.getElementById('systemPrompt');
        this.exampleButton = document.getElementById('systemPromptBtn');
        this.initialize();
    }

    initialize() {
        if(this.exampleButton) this.exampleButton.addEventListener('click', () => this.prefillExample());
    }

    prefillExample() {
        const examplePrompt = `You are a personalized document analyzer. Your task is to analyze documents and extract relevant information.

Analyze the document content and extract the following information into a structured JSON object:

1. title: Create a concise, meaningful title for the document
2. correspondent: Identify the sender/institution but do not include addresses
3. tags: Select up to 4 relevant thematic tags
4. document_date: Extract the document date (format: YYYY-MM-DD)
5. document_type: Determine a precise type that classifies the document (e.g. Invoice, Contract, Employer, Information and so on)
6. language: Determine the document language (e.g. "de" or "en")

Important rules for the analysis:

For tags:
- FIRST check the existing tags before suggesting new ones
- Use only relevant categories
- Maximum 4 tags per document, less if sufficient (at least 1)
- Avoid generic or too specific tags
- Use only the most important information for tag creation
- The output language is the one used in the document! IMPORTANT!

For the title:
- Short and concise, NO ADDRESSES
- Contains the most important identification features
- For invoices/orders, mention invoice/order number if available
- The output language is the one used in the document! IMPORTANT!

For the correspondent:
- Identify the sender or institution
- When generating the correspondent, always create the shortest possible form of the company name (e.g. "Amazon" instead of "Amazon EU SARL, German branch")

For the document date:
- Extract the date of the document
- Use the format YYYY-MM-DD
- If multiple dates are present, use the most relevant one

For the language:
- Determine the document language
- Use language codes like "de" for German or "en" for English
- If the language is not clear, use "und" as a placeholder`;

        this.systemPrompt.value = examplePrompt;
    }
}

// Password Management
class PasswordManager {
    constructor() {
        this.passwordInput = document.getElementById('password');
        this.confirmPasswordInput = document.getElementById('confirmPassword');
        this.passwordStrengthDiv = document.getElementById('password-strength');
        this.passwordMatchDiv = document.getElementById('password-match');
        this.form = document.getElementById('setupForm');
        this.initialize();
    }

    initialize() {
        // Add event listeners for password validation
        if(this.passwordInput) this.passwordInput.addEventListener('input', () => {
            const result = this.checkPasswordStrength(this.passwordInput.value);
            this.passwordStrengthDiv.innerHTML = result.html;
            if (this.confirmPasswordInput.value) this.checkPasswordMatch();
        });

        if(this.confirmPasswordInput) this.confirmPasswordInput.addEventListener('input', () => this.checkPasswordMatch());

        // Add form validation
        this.initializeFormValidation();
    }

    checkPasswordStrength(password) {
        let strength = 0;
        const checks = {
            length: password.length >= 8,
            lowercase: /[a-z]/.test(password),
            uppercase: /[A-Z]/.test(password),
            numbers: /\d/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };

        strength = Object.values(checks).filter(Boolean).length;

        let message = '';
        let color = '';

        switch (strength) {
            case 0:
            case 1:
                message = 'Very Weak';
                color = 'text-red-500';
                break;
            case 2:
                message = 'Weak';
                color = 'text-orange-500';
                break;
            case 3:
                message = 'Medium';
                color = 'text-yellow-500';
                break;
            case 4:
                message = 'Strong';
                color = 'text-blue-500';
                break;
            case 5:
                message = 'Very Strong';
                color = 'text-green-500';
                break;
        }

        return {
            isValid: strength >= 3,
            html: `
                <div class="${color} text-sm">
                    <span class="font-medium">Password Strength: ${message}</span>
                    <ul class="mt-1 list-disc list-inside">
                        ${!checks.length ? '<li>At least 8 characters</li>' : ''}
                        ${!checks.lowercase ? '<li>At least 1 lowercase letter</li>' : ''}
                        ${!checks.uppercase ? '<li>At least 1 uppercase letter</li>' : ''}
                        ${!checks.numbers ? '<li>At least 1 number</li>' : ''}
                        ${!checks.special ? '<li>At least 1 special character</li>' : ''}
                    </ul>
                </div>
            `
        };
    }

    checkPasswordMatch() {
        const password = this.passwordInput.value;
        const confirmPassword = this.confirmPasswordInput.value;

        if (confirmPassword) {
            const matches = password === confirmPassword;
            this.passwordMatchDiv.innerHTML = matches
                ? '<div class="text-green-500 text-sm">Passwords match</div>'
                : '<div class="text-red-500 text-sm">Passwords do not match</div>';
            return matches;
        }
        return false;
    }

    initializeFormValidation() {
        if(!this.form) return;
        const originalSubmit = this.form.onsubmit;

        this.form.onsubmit = (e) => {
            if (this.passwordInput && this.passwordInput.value) {  // Only validate if password field is present and has a value
                const passwordStrength = this.checkPasswordStrength(this.passwordInput.value);
                const passwordsMatch = this.checkPasswordMatch();

                if (!passwordStrength.isValid || !passwordsMatch) {
                    e.preventDefault();
                    Swal.fire({
                        icon: 'error',
                        title: 'Invalid Password',
                        html: 'Please ensure your password:<br>' +
                            '- Is strong enough (at least "Medium" strength)<br>' +
                            '- Matches in both fields'
                    });
                    return false;
                }
            }

            // Call the original submit handler if it exists
            if (originalSubmit) return originalSubmit.call(this.form, e);
        };
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    /* eslint-disable no-unused-vars */
    const themeManager = new ThemeManager();
    const formManager = new FormManager();
    const tagsManager = new TagsManager();
    const promptTagsManager = new PromptTagsManager();
    const promptManager = new PromptManager();
    const passwordManager = new PasswordManager();
    /* eslint-enable no-unused-vars */
});

// Initialize textarea newlines
document.addEventListener('DOMContentLoaded', (event) => {
    const systemPromptTextarea = document.getElementById('systemPrompt');
    if(systemPromptTextarea) systemPromptTextarea.value = systemPromptTextarea.value.replace(/\\n/g, '\n');
});
