/**
 * users.js
 * Admin-only user management script.
 */

function fetchUsers() {
    fetch(API_BASE + 'get_users.php?action=list')
        .then(res => res.json())
        .then(data => {
            const tbody = document.getElementById('usersTbody');
            if (data.status !== 'success') {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ef4444;">${data.message || 'Error loading users'}</td></tr>`;
                return;
            }

            if (data.users.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-secondary);">No users found.</td></tr>`;
                return;
            }

            tbody.innerHTML = data.users.map(u => `
                <tr>
                    <td style="font-weight:500;">${u.full_name}</td>
                    <td style="color:var(--text-secondary);">${u.username}</td>
                    <td>
                        <span class="badge ${u.role === 'admin' ? 'critical' : u.role === 'viewer' ? 'info' : 'warning'}">
                            ${u.role}
                        </span>
                    </td>
                    <td>
                        <span style="color: ${u.is_active == 1 ? 'var(--success-color)' : 'var(--text-secondary)'}">
                            ${u.is_active == 1 ? 'Active' : 'Suspended'}
                        </span>
                    </td>
                    <td style="font-size:0.85rem; color:var(--text-secondary);">${new Date(u.created_at).toLocaleDateString()}</td>
                    <td>
                        <button class="action-btn edit" onclick='openModal(${JSON.stringify(u).replace(/'/g, "&apos;")})'>
                            <i data-feather="edit-2" style="width:14px;"></i> Edit
                        </button>
                        <button class="action-btn delete" onclick="deleteUser(${u.id}, '${u.username}')">
                            <i data-feather="trash-2" style="width:14px;"></i> Delete
                        </button>
                    </td>
                </tr>
            `).join('');

            if (typeof feather !== 'undefined') feather.replace();
        })
        .catch(err => {
            console.error(err);
            document.getElementById('usersTbody').innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ef4444;">Network Error.</td></tr>`;
        });
}

function openCreateModal() {
    const modal = document.getElementById('userModal');
    modal.style.display = 'flex';
}

function closeCreateModal() {
    const modal = document.getElementById('userModal');
    modal.style.display = 'none';
}

// Close modal if user clicks outside of the white box
window.onclick = function (event) {
    const modal = document.getElementById('userModal');
    if (event.target == modal) {
        closeCreateModal();
    }
}

window.onclick = function (event) {
    // If the clicked element has a class like 'modal-overlay' (assuming your CSS uses that)
    // OR simply check if the ID contains 'Modal'
    if (event.target.id.endsWith('Modal')) {
        // This dynamically finds which modal is open and hides it
        event.target.style.display = 'none';

        // If it's the create modal, we also want to reset the form
        if (event.target.id === 'createModal') {
            document.getElementById('createUserForm').reset();
        }
    }
}

// Form Submission handling
document.getElementById('addUserForm').onsubmit = function (e) {
    e.preventDefault();
    const formData = new FormData(this);
    console.log("New User Data:", Object.fromEntries(formData));

    // Add your save logic here!

    closeCreateModal();
    this.reset();
};

function openModal(user) {
    document.getElementById('edit-id').value = user.id;
    document.getElementById('edit-fullname').value = user.full_name;
    document.getElementById('edit-email').value = user.email;
    document.getElementById('edit-phone').value = user.phone;
    document.getElementById('edit-role').value = user.role;
    document.getElementById('edit-status').value = user.is_active;

    document.getElementById('editModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('editModal').style.display = 'none';
    document.getElementById('edit-new-password').value = '';
    document.getElementById('edit-confirm-password').value = '';
    const strBar = document.getElementById('editStrBar');
    if (strBar) {
        strBar.style.width = '0%';
        strBar.style.background = 'transparent';
    }
    const strLabel = document.getElementById('editStrLabel');
    if (strLabel) strLabel.textContent = '';
}

function openCreateModal() {
    document.getElementById('createModal').style.display = 'flex';
}

function closeCreateModal() {
    document.getElementById('createModal').style.display = 'none';
    document.getElementById('createUserForm').reset();
    const strBar = document.getElementById('createStrBar');
    if (strBar) {
        strBar.style.width = '0%';
        strBar.style.background = 'transparent';
    }
    const strLabel = document.getElementById('createStrLabel');
    if (strLabel) strLabel.textContent = '';
}

function deleteUser(id, username) {
    if (!confirm(`Are you sure you want to permanently delete user @${username}?`)) return;

    fetch(API_BASE + 'get_users.php?action=delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id })
    })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                alert('User deleted.');
                fetchUsers();
            } else {
                alert('Error: ' + data.message);
            }
        })
        .catch(err => alert('Network error deleting user.'));
}

function togglePw(id, btn) {
    const input = document.getElementById(id);
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.setAttribute('data-feather', 'eye-off');
    } else {
        input.type = 'password';
        icon.setAttribute('data-feather', 'eye');
    }
    if (typeof feather !== 'undefined') feather.replace();
}

function createStrength(val) {
    updateStrengthBar(val, 'createStrBar', 'createStrLabel');
}

function editStrength(val) {
    updateStrengthBar(val, 'editStrBar', 'editStrLabel');
}

function updateStrengthBar(val, barId, lblId) {
    let strength = 0;
    if (val.length >= 8) strength++;
    if (/[A-Z]/.test(val)) strength++;
    if (/[0-9]/.test(val)) strength++;
    if (/[^A-Za-z0-9]/.test(val)) strength++;

    const bar = document.getElementById(barId);
    const lbl = document.getElementById(lblId);
    if (!bar || !lbl) return;

    if (val.length === 0) {
        bar.style.width = '0%';
        bar.style.background = 'transparent';
        lbl.textContent = '';
        return;
    }

    const widths = ['25%', '50%', '75%', '100%'];
    const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
    const labels = ['Weak', 'Fair', 'Good', 'Strong'];

    const idx = Math.max(0, strength - 1);
    bar.style.width = widths[idx];
    bar.style.background = colors[idx];
    lbl.textContent = labels[idx];
    lbl.style.color = colors[idx];
}

document.addEventListener('DOMContentLoaded', () => {
    fetchUsers();

    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', fetchUsers);

    // Auto-open modal if requested via URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'add') {
        setTimeout(openCreateModal, 300); // Small delay to ensure feather icons etc are ready
    }

    // Create User Form
    const createUserForm = document.getElementById('createUserForm');
    if (createUserForm) {
        createUserForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const password = document.getElementById('create-password').value;
            const confirmPassword = document.getElementById('create-confirm-password').value;

            if (password !== confirmPassword) {
                alert('Passwords do not match.');
                return;
            }

            const payload = {
                full_name: document.getElementById('create-fullname').value,
                username: document.getElementById('create-username').value,
                email: document.getElementById('create-email').value,
                phone: document.getElementById('create-phone').value,
                role: document.getElementById('create-role').value,
                password: password
            };

            const tanzaniaPhoneRegex = /^\+255\d{9}$/;
            if (payload.phone && !tanzaniaPhoneRegex.test(payload.phone)) {
                alert('Please enter a valid Tanzania phone number (+255 followed by 9 digits).');
                return;
            }

            const btn = document.getElementById('submitUserBtn');
            btn.textContent = 'Creating...';
            btn.disabled = true;

            fetch(API_BASE + 'get_users.php?action=create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        alert('User created successfully.');
                        closeCreateModal();
                        fetchUsers();
                    } else {
                        alert('Error: ' + data.message);
                    }
                })
                .catch(err => alert('Network error creating user.'))
                .finally(() => {
                    btn.textContent = 'Create User';
                    btn.disabled = false;
                });
        });
    }

    document.getElementById('editUserForm').addEventListener('submit', function (e) {
        e.preventDefault();

        const newPassword = document.getElementById('edit-new-password').value;
        const confirmPassword = document.getElementById('edit-confirm-password').value;

        if (newPassword && newPassword !== confirmPassword) {
            alert('New passwords do not match.');
            return;
        }

        const payload = {
            id: document.getElementById('edit-id').value,
            full_name: document.getElementById('edit-fullname').value,
            email: document.getElementById('edit-email').value,
            phone: document.getElementById('edit-phone').value,
            role: document.getElementById('edit-role').value,
            is_active: parseInt(document.getElementById('edit-status').value)
        };

        const tanzaniaPhoneRegex = /^\+255\d{9}$/;
        if (!tanzaniaPhoneRegex.test(payload.phone)) {
            alert('Please enter a valid Tanzania phone number (+255 followed by 9 digits).');
            return;
        }

        if (newPassword) {
            payload.password = newPassword;
        }

        const btn = document.getElementById('saveUserBtn');
        btn.textContent = 'Saving...';
        btn.disabled = true;

        fetch(API_BASE + 'get_users.php?action=update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    closeModal();
                    fetchUsers();
                } else {
                    alert('Error: ' + data.message);
                }
            })
            .catch(err => alert('Network error updating user.'))
            .finally(() => {
                btn.textContent = 'Submit';
                btn.disabled = false;
            });
    });
});
