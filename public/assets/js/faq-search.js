// FAQ Search Functionality
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('faq-search-input');
    const faqItems = document.querySelectorAll('.faq-item, .broadband-facts-item');

    if (!searchInput || faqItems.length === 0) return;

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();

        faqItems.forEach(item => {
            const question = item.querySelector('summary, .fact-question, h3');
            const answer = item.querySelector('.fact-answer, p');

            if (!question) return;

            const questionText = question.textContent.toLowerCase();
            const answerText = answer ? answer.textContent.toLowerCase() : '';

            const matches = questionText.includes(searchTerm) || answerText.includes(searchTerm);

            item.style.display = matches || searchTerm === '' ? '' : 'none';
        });

        // Show "no results" message if needed
        const visibleItems = Array.from(faqItems).filter(item => item.style.display !== 'none');
        const noResults = document.getElementById('faq-no-results');

        if (visibleItems.length === 0 && searchTerm !== '') {
            if (noResults) {
                noResults.style.display = 'block';
            }
        } else if (noResults) {
            noResults.style.display = 'none';
        }
    });

    // Add search styling if not already in CSS
    if (searchInput) {
        searchInput.placeholder = 'Search FAQs...';
        searchInput.style.padding = '12px 16px';
        searchInput.style.fontSize = '1rem';
        searchInput.style.borderRadius = '8px';
        searchInput.style.border = '1px solid #e2e8f0';
        searchInput.style.width = '100%';
        searchInput.style.maxWidth = '500px';
        searchInput.style.marginBottom = '24px';
    }
});
