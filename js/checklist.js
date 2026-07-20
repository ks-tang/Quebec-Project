document.addEventListener("DOMContentLoaded", () => {
    const checklistSection = document.querySelector('.checklist-container') || document.body;
    
    // 1. Charger et écouter l'état des cases
    const checkboxes = checklistSection.querySelectorAll('input[type="checkbox"]');
    
    checkboxes.forEach(checkbox => {
        const savedState = localStorage.getItem(checkbox.id);
        if (savedState === 'true') {
            checkbox.checked = true;
        }
        
        checkbox.addEventListener('change', (e) => {
            localStorage.setItem(e.target.id, e.target.checked);
        });
    });

    // 2. Choix unique pour les banques (comportement radio)
    const bankCheckboxes = checklistSection.querySelectorAll('.bank-choice');
    bankCheckboxes.forEach(bankCheck => {
        bankCheck.addEventListener('change', (e) => {
            if (e.target.checked) {
                bankCheckboxes.forEach(otherCheck => {
                    if (otherCheck !== e.target) {
                        otherCheck.checked = false;
                        localStorage.setItem(otherCheck.id, 'false');
                    }
                });
            }
        });
    });
});