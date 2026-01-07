// public/assets/js/main.js

// --- Global Scope for Google Maps Callback ---
window.initAutocomplete = function() {
    console.log("Google Maps API Loaded");
    
    const input = document.getElementById('cfn-address-input');
    if (!input) return;

    const options = {
        fields: ["formatted_address", "geometry", "name"],
        strictBounds: false,
    };

    // Initialize Autocomplete
    const autocomplete = new google.maps.places.Autocomplete(input, options);

    // 1. Handle Click Selection from Dropdown
    autocomplete.addListener('place_changed', function() {
        const place = autocomplete.getPlace();
        if (place.formatted_address) {
            redirectToApp(place.formatted_address);
        } else {
            redirectToApp(input.value);
        }
    });

    // 2. Handle 'Enter' Key manually
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault(); 
            setTimeout(function() {
                redirectToApp(input.value);
            }, 300); 
        }
    });
};

let isRedirecting = false;

function redirectToApp(address) {
    if (isRedirecting) return;
    
    const input = document.getElementById('cfn-address-input');
    const msg = document.getElementById('redirect-message');

    if(address && address.length > 5) {
        isRedirecting = true;
        
        // Visual Feedback
        if(input) {
            input.style.borderColor = "var(--cfn-green)";
            input.style.backgroundColor = "#f0fdf4";
        }
        if(msg) {
            msg.classList.remove('hidden');
        }
        
        // Redirect Logic
        const targetUrl = 'https://fiber-service-query.web.app/query.html?auto=true&address=' + encodeURIComponent(address);
        window.location.href = targetUrl;
    }
}

// --- Standard Site Logic ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Scroll Animations
    const observerOptions = { root: null, rootMargin: '0px', threshold: 0.1 };
    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.fade-in-section').forEach(section => {
        observer.observe(section);
    });
});