const menu = document.getElementById('navbar-menu');
const btn = document.getElementById('navbar-menu-btn');
const dropdown = document.getElementById('navbar-dropdown');

if (menu && btn && dropdown) {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !dropdown.classList.contains('hidden');
    dropdown.classList.toggle('hidden', isOpen);
    btn.setAttribute('aria-expanded', String(!isOpen));
  });

  document.addEventListener('click', () => {
    dropdown.classList.add('hidden');
    btn.setAttribute('aria-expanded', 'false');
  });

  dropdown.addEventListener('click', (e) => e.stopPropagation());
}
