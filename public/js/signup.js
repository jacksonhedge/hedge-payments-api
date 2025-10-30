// Signup form handling

const signupForm = document.getElementById('signupForm');

signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Get form data
    const formData = {
        companyName: document.getElementById('companyName').value,
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        confirmPassword: document.getElementById('confirmPassword').value,
        usageType: document.getElementById('usageType').value
    };

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
        alert('Passwords do not match!');
        return;
    }

    // Validate password length
    if (formData.password.length < 8) {
        alert('Password must be at least 8 characters long!');
        return;
    }

    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Creating account...';
    submitBtn.disabled = true;

    try {
        // TODO: Send signup request to API
        // For now, we'll simulate a signup process

        console.log('Signup data:', formData);

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Show success message
        alert('🎉 Account created successfully! Check your email for verification.');

        // Redirect to success page or login
        window.location.href = '/success.html';

    } catch (error) {
        console.error('Signup error:', error);
        alert('An error occurred during signup. Please try again.');
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

// Password strength indicator
const passwordInput = document.getElementById('password');
passwordInput.addEventListener('input', (e) => {
    const password = e.target.value;
    let strength = 0;

    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
    if (password.match(/\d/)) strength++;
    if (password.match(/[^a-zA-Z\d]/)) strength++;

    // You could add a visual strength indicator here
    console.log('Password strength:', strength);
});
