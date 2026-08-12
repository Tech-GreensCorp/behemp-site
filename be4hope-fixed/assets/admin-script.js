// Be4Hope Medication Tracker - Admin JavaScript

jQuery(document).ready(function($) {
    
    // Patient form submission
    $(document).on('submit', '#patient-form', function(e) {
        e.preventDefault();
        
        const formData = $(this).serialize();
        const actionData = formData + '&action=be4hope_save_patient';
        
        $.post(be4hope_ajax.ajax_url, actionData, function(response) {
            if (response.success) {
                alert('Paciente salvo com sucesso!');
                window.location.href = 'admin.php?page=be4hope-patients';
            } else {
                alert('Erro: ' + response.data);
            }
        }).fail(function() {
            alert('Erro de conexão. Tente novamente.');
        });
    });
    
    // Medication form submission
    $(document).on('submit', '#medication-form', function(e) {
        e.preventDefault();
        
        const formData = $(this).serialize();
        const actionData = formData + '&action=be4hope_save_medication';
        
        $.post(be4hope_ajax.ajax_url, actionData, function(response) {
            if (response.success) {
                alert('Medicação salva com sucesso!');
                window.location.href = 'admin.php?page=be4hope-medications';
            } else {
                alert('Erro: ' + response.data);
            }
        }).fail(function() {
            alert('Erro de conexão. Tente novamente.');
        });
    });
    
    // Dosage calculator
    $(document).on('click', '#calculate-dosage', function() {
        const weight = $('#patient_weight').val();
        const ageGroup = $('#patient_age').val();
        const experience = $('#experience_level').val();
        const product = $('#product_select').val();
        
        if (!weight || !ageGroup || !experience || !product) {
            alert('Por favor, preencha todos os campos.');
            return;
        }
        
        $.post(be4hope_ajax.ajax_url, {
            action: 'be4hope_calculate_dosage',
            nonce: be4hope_ajax.nonce,
            weight: weight,
            age_group: ageGroup,
            experience: experience,
            product: product
        }, function(response) {
            if (response.success) {
                displayDosageResult(response.data);
            } else {
                alert('Erro no cálculo: ' + response.data);
            }
        }).fail(function() {
            alert('Erro de conexão. Tente novamente.');
        });
    });
    
    // Display dosage calculation result
    function displayDosageResult(data) {
        const resultHtml = `
            <div class="dosage-detail">
                <strong>Dosagem Recomendada:</strong> ${data.daily_cbd} mg CBD por dia
            </div>
            <div class="dosage-detail">
                <strong>Gotas por Dia:</strong> ${data.daily_drops} gotas (${data.drops_per_dose} gotas por tomada, 2x ao dia)
            </div>
            <div class="dosage-detail">
                <strong>Dosagem Máxima:</strong> ${data.max_daily_cbd} mg CBD por dia (${data.max_daily_drops} gotas)
            </div>
            <div class="dosage-detail">
                <strong>Concentração do Produto:</strong> ${data.product_concentration} mg CBD por gota
            </div>
            <div class="dosage-detail">
                <strong>Protocolo:</strong> Começar com a dose mínima e aumentar gradualmente a cada 7-14 dias conforme necessário e tolerância.
            </div>
        `;
        
        $('#dosage-details').html(resultHtml);
        $('#dosage-result').show();
    }
    
    // Auto-calculate age from birth date
    $(document).on('change', '#birth_date', function() {
        const birthDate = new Date($(this).val());
        const today = new Date();
        const age = Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
        if (age >= 0 && age <= 120) {
            // Could add age field if needed
        }
    });
    
    // Auto-calculate medication duration
    $(document).on('change', '#daily_drops, #bottle_count, #start_date', function() {
        const dailyDrops = parseInt($('#daily_drops').val()) || 0;
        const bottleCount = parseInt($('#bottle_count').val()) || 1;
        const startDate = $('#start_date').val();
        const dropsPerBottle = 900; // Standard for 30ml bottles
        
        if (dailyDrops > 0 && startDate) {
            const totalDrops = bottleCount * dropsPerBottle;
            const durationDays = Math.floor(totalDrops / dailyDrops);
            
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + durationDays);
            
            // Show duration info
            const months = Math.floor(durationDays / 30);
            const remainingDays = durationDays % 30;
            
            let durationText = '';
            if (months > 0) {
                durationText = months + ' mês' + (months > 1 ? 'es' : '');
                if (remainingDays > 0) {
                    durationText += ' e ' + remainingDays + ' dia' + (remainingDays > 1 ? 's' : '');
                }
            } else {
                durationText = durationDays + ' dia' + (durationDays > 1 ? 's' : '');
            }
            
            $('.duration-info').remove();
            const infoHtml = `
                <tr class="duration-info">
                    <td colspan="2" style="background: #e7f3ff; padding: 10px; border-radius: 4px;">
                        <strong>Duração estimada:</strong> ${durationText}<br>
                        <strong>Previsão de término:</strong> ${endDate.toLocaleDateString('pt-BR')}<br>
                        <strong>Alerta será enviado em:</strong> ${new Date(endDate.getTime() - 40 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')}
                    </td>
                </tr>
            `;
            $('#bottle_count').closest('tr').after(infoHtml);
        }
    });
    
    // Form validation
    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    // Real-time email validation
    $(document).on('blur', 'input[type="email"]', function() {
        const email = $(this).val();
        if (email && !validateEmail(email)) {
            $(this).css('border-color', '#d63638');
            showFieldError($(this), 'Email inválido');
        } else {
            $(this).css('border-color', '#8c8f94');
            hideFieldError($(this));
        }
    });
    
    // Show field error
    function showFieldError(field, message) {
        hideFieldError(field);
        field.after(`<div class="field-error" style="color: #d63638; font-size: 12px; margin-top: 5px;">${message}</div>`);
    }
    
    // Hide field error
    function hideFieldError(field) {
        field.siblings('.field-error').remove();
    }
    
    // Confirm before leaving page with unsaved changes
    let formChanged = false;
    $(document).on('input change', 'form input, form select, form textarea', function() {
        formChanged = true;
    });
    
    $(document).on('submit', 'form', function() {
        formChanged = false;
    });
    
    $(window).on('beforeunload', function() {
        if (formChanged) {
            return 'Você tem alterações não salvas. Tem certeza que deseja sair?';
        }
    });
});

// Global utility functions
window.Be4Hope = {
    // Format currency
    formatCurrency: function(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    },
    
    // Format date
    formatDate: function(date) {
        return new Date(date).toLocaleDateString('pt-BR');
    },
    
    // Calculate days between dates
    daysBetween: function(date1, date2) {
        const oneDay = 24 * 60 * 60 * 1000;
        return Math.round(Math.abs((new Date(date1) - new Date(date2)) / oneDay));
    }
};
