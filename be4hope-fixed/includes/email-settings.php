<?php
// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Handle form submissions
if (isset($_POST['save_email_settings'])) {
    update_option('be4hope_email_from_name', sanitize_text_field($_POST['email_from_name']));
    update_option('be4hope_email_from_address', sanitize_email($_POST['email_from_address']));
    update_option('be4hope_admin_email', sanitize_email($_POST['admin_email']));
    update_option('be4hope_smtp_enabled', isset($_POST['smtp_enabled']) ? 1 : 0);
    update_option('be4hope_smtp_host', sanitize_text_field($_POST['smtp_host']));
    update_option('be4hope_smtp_port', intval($_POST['smtp_port']));
    update_option('be4hope_smtp_username', sanitize_text_field($_POST['smtp_username']));
    update_option('be4hope_smtp_password', sanitize_text_field($_POST['smtp_password']));
    
    echo '<div class="notice notice-success"><p>Configurações salvas com sucesso!</p></div>';
}

// Get current settings
$email_from_name = get_option('be4hope_email_from_name', get_bloginfo('name'));
$email_from_address = get_option('be4hope_email_from_address', get_option('admin_email'));
$admin_email = get_option('be4hope_admin_email', get_option('admin_email'));
$smtp_enabled = get_option('be4hope_smtp_enabled', 0);
$smtp_host = get_option('be4hope_smtp_host', '');
$smtp_port = get_option('be4hope_smtp_port', 587);
$smtp_username = get_option('be4hope_smtp_username', '');
$smtp_password = get_option('be4hope_smtp_password', '');
?>

<div class="wrap">
    <h1>Configurações de Email</h1>
    
    <div style="max-width: 800px;">
        
        <!-- Email Settings -->
        <div class="postbox">
            <div class="postbox-header">
                <h2 class="hndle">Configurações de Email</h2>
            </div>
            <div class="inside">
                <form method="post" action="">
                    <?php wp_nonce_field('be4hope_email_settings', 'nonce'); ?>
                    
                    <table class="form-table">
                        <tr>
                            <th scope="row"><label for="email_from_name">Nome do Remetente</label></th>
                            <td>
                                <input type="text" id="email_from_name" name="email_from_name" class="regular-text" 
                                       value="<?php echo esc_attr($email_from_name); ?>">
                                <p class="description">Nome que aparecerá como remetente dos emails</p>
                            </td>
                        </tr>
                            <tr>
                                <th scope="row"><label for="email_from_address">Email do Remetente</label></th>
                                <td>
                                    <input type="email" id="email_from_address" name="email_from_address" class="regular-text" 
                                           value="<?php echo esc_attr($email_from_address); ?>">
                                    <p class="description">Endereço de email que aparecerá como remetente</p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row"><label for="admin_email">Email do Administrador</label></th>
                                <td>
                                    <input type="email" id="admin_email" name="admin_email" class="regular-text" 
                                           value="<?php echo esc_attr($admin_email); ?>">
                                    <p class="description">Email que receberá os alertas automáticos do sistema</p>
                                </td>
                            </tr>
                    </table>
                    
                    <h3>Configurações SMTP (Opcional)</h3>
                    <table class="form-table">
                        <tr>
                            <th scope="row">Usar SMTP</th>
                            <td>
                                <label>
                                    <input type="checkbox" name="smtp_enabled" value="1" <?php checked($smtp_enabled, 1); ?>>
                                    Habilitar envio via SMTP (recomendado)
                                </label>
                            </td>
                        </tr>
                        <tr id="smtp-settings" style="<?php echo $smtp_enabled ? '' : 'display: none;'; ?>">
                            <td colspan="2">
                                <table class="form-table">
                                    <tr>
                                        <th scope="row"><label for="smtp_host">Servidor SMTP</label></th>
                                        <td>
                                            <input type="text" id="smtp_host" name="smtp_host" class="regular-text" 
                                                   value="<?php echo esc_attr($smtp_host); ?>" placeholder="smtp.gmail.com">
                                        </td>
                                    </tr>
                                    <tr>
                                        <th scope="row"><label for="smtp_port">Porta</label></th>
                                        <td>
                                            <input type="number" id="smtp_port" name="smtp_port" class="small-text" 
                                                   value="<?php echo esc_attr($smtp_port); ?>" placeholder="587">
                                            <p class="description">587 para Gmail/TLS, 465 para SSL</p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <th scope="row"><label for="smtp_username">Usuário SMTP</label></th>
                                        <td>
                                            <input type="text" id="smtp_username" name="smtp_username" class="regular-text" 
                                                   value="<?php echo esc_attr($smtp_username); ?>" placeholder="seu@email.com">
                                        </td>
                                    </tr>
                                    <tr>
                                        <th scope="row"><label for="smtp_password">Senha SMTP</label></th>
                                        <td>
                                            <input type="password" id="smtp_password" name="smtp_password" class="regular-text" 
                                                   value="<?php echo esc_attr($smtp_password); ?>" placeholder="Sua senha">
                                            <p class="description">Para Gmail, use uma senha de aplicativo</p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                    
                    <p class="submit">
                        <button type="submit" name="save_email_settings" class="button button-primary">Salvar Configurações</button>
                    </p>
                </form>
            </div>
        </div>
        
        <!-- Email Test -->
        <div class="postbox">
            <div class="postbox-header">
                <h2 class="hndle">Teste de Email</h2>
            </div>
            <div class="inside">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <h4>Enviar Email de Teste</h4>
                        <form id="test-email-form">
                            <table class="form-table">
                                <tr>
                                    <th scope="row"><label for="test_email_to">Enviar para</label></th>
                                    <td>
                                        <input type="email" id="test_email_to" name="test_email_to" class="regular-text" 
                                               value="<?php echo esc_attr(get_option('admin_email')); ?>">
                                    </td>
                                </tr>
                                <tr>
                                    <th scope="row"><label for="test_message">Mensagem</label></th>
                                    <td>
                                        <textarea id="test_message" name="test_message" rows="4" class="large-text">Este é um email de teste do sistema Be4Hope. Se você recebeu esta mensagem, as configurações de email estão funcionando corretamente!</textarea>
                                    </td>
                                </tr>
                            </table>
                            <p>
                                <button type="button" id="send-test-email" class="button button-primary">Enviar Teste</button>
                                <button type="button" id="send-admin-alert-test" class="button" style="margin-left: 10px;">Testar Alerta Admin</button>
                            </p>
                        </form>
                        
                        <div id="test-result" style="display: none; margin-top: 15px; padding: 10px; border-radius: 4px;"></div>
                    </div>
                    
                    <div>
                        <h4>Status do Sistema</h4>
                        <div style="background: #f9f9f9; padding: 15px; border-radius: 4px;">
                            <p><strong>Função wp_mail():</strong> 
                                <?php echo function_exists('wp_mail') ? '✅ Disponível' : '❌ Não disponível'; ?>
                            </p>
                            <p><strong>SMTP Configurado:</strong> 
                                <?php echo $smtp_enabled ? '✅ Sim' : '⚠️ Não (usando PHP mail)'; ?>
                            </p>
                            <p><strong>Último Teste:</strong> 
                                <?php 
                                $last_test = get_option('be4hope_last_email_test', 'Nunca');
                                echo $last_test !== 'Nunca' ? date('d/m/Y H:i', $last_test) : 'Nunca';
                                ?>
                            </p>
                            <p><strong>Status:</strong> 
                                <span id="email-status">
                                    <?php 
                                    $last_test_result = get_option('be4hope_last_email_test_result', 'unknown');
                                    if ($last_test_result === 'success') {
                                        echo '✅ Funcionando';
                                    } elseif ($last_test_result === 'error') {
                                        echo '❌ Com problemas';
                                    } else {
                                        echo '⚠️ Não testado';
                                    }
                                    ?>
                                </span>
                            </p>
                        </div>
                        
                        <h4 style="margin-top: 20px;">Configurações Recomendadas</h4>
                        <div style="background: #e7f3ff; padding: 15px; border-radius: 4px; font-size: 14px;">
                            <p><strong>Gmail:</strong></p>
                            <ul style="margin: 5px 0 15px 20px;">
                                <li>Servidor: smtp.gmail.com</li>
                                <li>Porta: 587</li>
                                <li>Use senha de aplicativo</li>
                            </ul>
                            
                            <p><strong>Outlook/Hotmail:</strong></p>
                            <ul style="margin: 5px 0 0 20px;">
                                <li>Servidor: smtp-mail.outlook.com</li>
                                <li>Porta: 587</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Email Templates -->
        <div class="postbox">
            <div class="postbox-header">
                <h2 class="hndle">Templates de Email</h2>
            </div>
            <div class="inside">
                <div style="background: #fff3cd; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0;">📧 Templates Personalizáveis</h4>
                    <p style="margin: 0;">Os templates de email podem ser personalizados usando variáveis como <code>{PATIENT_NAME}</code>, <code>{PRODUCT_NAME}</code>, <code>{END_DATE}</code>, etc.</p>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <h4>Alerta de Medicação</h4>
                        <textarea readonly rows="6" class="large-text">Olá {PATIENT_NAME},

Sua medicação {PRODUCT_NAME} está próxima do fim.
Previsão de término: {END_DATE}

Entre em contato conosco para providenciar a recompra.

Atenciosamente,
Equipe Be4Hope</textarea>
                    </div>
                    
                    <div>
                        <h4>Renovação de Licença</h4>
                        <textarea readonly rows="6" class="large-text">Olá {PATIENT_NAME},

Sua licença ANVISA {LICENSE_NUMBER} vence em breve.
Data de vencimento: {EXPIRY_DATE}

Entre em contato conosco para renovação.

Atenciosamente,
Equipe Be4Hope</textarea>
                    </div>
                </div>
                
                <p style="margin-top: 20px; color: #666;">
                    <em>Os templates completos serão implementados na próxima versão do plugin com editor visual.</em>
                </p>
            </div>
        </div>
        
    </div>
</div>

<script>
jQuery(document).ready(function($) {
    // Toggle SMTP settings
    $('input[name="smtp_enabled"]').on('change', function() {
        if ($(this).is(':checked')) {
            $('#smtp-settings').show();
        } else {
            $('#smtp-settings').hide();
        }
    });
    
    // Send test email
    $('#send-test-email').on('click', function() {
        const button = $(this);
        const originalText = button.text();
        
        button.prop('disabled', true).text('Enviando...');
        $('#test-result').hide();
        
        const testData = {
            action: 'be4hope_send_test_email',
            nonce: '<?php echo wp_create_nonce('be4hope_nonce'); ?>',
            email_to: $('#test_email_to').val(),
            message: $('#test_message').val()
        };
        
        $.post(ajaxurl, testData, function(response) {
            let resultClass = response.success ? 'notice-success' : 'notice-error';
            let resultIcon = response.success ? '✅' : '❌';
            
            $('#test-result')
                .removeClass('notice-success notice-error')
                .addClass(resultClass)
                .html(`<p>${resultIcon} ${response.data}</p>`)
                .show();
            
            // Update status
            if (response.success) {
                $('#email-status').html('✅ Funcionando');
            } else {
                $('#email-status').html('❌ Com problemas');
            }
        }).fail(function() {
            $('#test-result')
                .removeClass('notice-success')
                .addClass('notice-error')
                .html('<p>❌ Erro de conexão. Tente novamente.</p>')
                .show();
        }).always(function() {
            button.prop('disabled', false).text(originalText);
        });
    });
    
    // Send admin alert test
    $('#send-admin-alert-test').on('click', function() {
        const button = $(this);
        const originalText = button.text();
        
        button.prop('disabled', true).text('Enviando...');
        $('#test-result').hide();
        
        const testData = {
            action: 'be4hope_send_admin_alert_test',
            nonce: '<?php echo wp_create_nonce('be4hope_nonce'); ?>'
        };
        
        $.post(ajaxurl, testData, function(response) {
            let resultClass = response.success ? 'notice-success' : 'notice-error';
            let resultIcon = response.success ? '✅' : '❌';
            
            $('#test-result')
                .removeClass('notice-success notice-error')
                .addClass(resultClass)
                .html(`<p>${resultIcon} ${response.data}</p>`)
                .show();
            
            // Update status
            if (response.success) {
                $('#email-status').html('✅ Funcionando');
            } else {
                $('#email-status').html('❌ Com problemas');
            }
        }).fail(function() {
            $('#test-result')
                .removeClass('notice-success')
                .addClass('notice-error')
                .html('<p>❌ Erro de conexão. Tente novamente.</p>')
                .show();
        }).always(function() {
            button.prop('disabled', false).text(originalText);
        });
    });
});
</script>
