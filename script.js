// script.js - Logic JavaScript dipisahkan dari HTML

document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // LOGIC FITUR GANTI FOTO (Dioptimalkan)
    // ==========================================
    const photoInput = document.getElementById('photo-upload-input');
    const photoPreview = document.getElementById('photo-preview');

    if (photoInput && photoPreview) {
        photoInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            
            // Validasi file adalah gambar
            if (file && file.type.startsWith('image/')) {
                // Menggunakan FileReader untuk memuat preview secara lokal (cepat & optimal)
                const reader = new FileReader();
                
                reader.onload = function(e) {
                    photoPreview.style.opacity = '0'; // Efek transisi
                    
                    setTimeout(() => {
                        photoPreview.src = e.target.result;
                        photoPreview.style.opacity = '1';
                    }, 150);
                };
                
                reader.readAsDataURL(file);
            } else {
                alert('Mohon pilih file gambar yang valid.');
            }
        });
    }

    // Tempatkan logic interaktif lainnya di sini (seperti pengaturan timeline, drag/drop, canvas WebGL, dll)

});
