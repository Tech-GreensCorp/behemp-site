<?php
// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Handle form submissions
if (isset($_POST['save_license'])) {
    global $wpdb;
    
    $data = array(
        'patient_id' => intval($_POST['patient_id']),
        'license_number' => sanitize_text_field($_POST['license_number']),
        'issue_date' => sanitize_text_field($_POST['issue_date']),
        'expiry_date' => sanitize_text_field($_POST['expiry_date']),
        'license_type' => sanitize_text_field($_POST['license_type']),
        'issuing_authority' => sanitize_text_field($_POST['issuing_authority']),
        'notes' => sanitize_textarea_field($_POST['notes']),
        'status' => 'active'
    );
    
    if (isset($_POST['license_id']) && !empty($_POST['license_id'])) {
        // Update
        $result = $wpdb->update(
            $wpdb->prefix . 'be4hope_licenses',
            $data,
            array('id' => intval($_POST['license_id']))
        );
        $message = 'Licença atualizada com sucesso!';
    } else {
        // Insert
        $data['created_at'] = current_time('mysql');
        $result = $wpdb->insert($wpdb->prefix . 'be4hope_licenses', $data);
        $message = 'Licença cadastrada com sucesso!';
    }
    
    if ($result !== false) {
        echo '<div class="notice notice-success"><p>' . $message . '</p></div>';
    } else {
        echo '<div class="notice notice-error"><p>Erro ao salvar licença.</p></div>';
    }
}

// Handle license deletion
if (isset($_GET['action']) && $_GET['action'] === 'delete' && isset($_GET['id'])) {
    global $wpdb;
    $wpdb->update(
        $wpdb->prefix . 'be4hope_licenses',
        array('status' => 'inactive'),
        array('id' => intval($_GET['id']))
    );
    echo '<div class="notice notice-success"><p>Licença removida com sucesso!</p></div>';
}

$action = isset($_GET['action']) ? $_GET['action'] : 'list';

if ($action === 'list') {
    show_licenses_list();
} elseif ($action === 'add' || $action === 'edit') {
    show_license_form($action);
}

function show_licenses_list() {
    global $wpdb;
    $licenses = $wpdb->get_results("
        SELECT l.*, p.name as patient_name, p.email as patient_email, p.phone as patient_phone
        FROM {$wpdb->prefix}be4hope_licenses l
        LEFT JOIN {$wpdb->prefix}be4hope_patients p ON l.patient_id = p.id
        WHERE l.status = 'active'
        ORDER BY l.expiry_date ASC
    ");
    ?>
    <div class="wrap">
        <h1>
            Licenças ANVISA
            <a href="<?php echo admin_url('admin.php?page=be4hope-licenses&action=add'); ?>" class="page-title-action">Adicionar Nova</a>
        </h1>
        
        <div style="background: #e7f3ff; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #E41B1C;">📋 Controle de Licenças ANVISA</h3>
            <p style="margin: 0;">Gerencie as licenças pessoais dos pacientes com alertas automáticos de renovação 60 dias antes do vencimento.</p>
        </div>
        
        <?php if (empty($licenses)): ?>
            <div style="text-align: center; padding: 50px; background: #fff; border: 1px solid #c3c4c7; border-radius: 4px;">
                <h3>Nenhuma licença cadastrada</h3>
                <p>Comece cadastrando as licenças ANVISA dos seus pacientes para controle de vencimentos.</p>
                <a href="<?php echo admin_url('admin.php?page=be4hope-licenses&action=add'); ?>" class="button button-primary">Cadastrar Primeira Licença</a>
            </div>
        <?php else: ?>
            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th style="width: 20%;">Paciente</th>
                        <th style="width: 15%;">Número da Licença</th>
                        <th style="width: 15%;">Tipo</th>
                        <th style="width: 12%;">Data Emissão</th>
                        <th style="width: 12%;">Vencimento</th>
                        <th style="width: 10%;">Status</th>
                        <th style="width: 16%;">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($licenses as $license): ?>
                    <?php
                    $days_to_expiry = (strtotime($license->expiry_date) - time()) / (60 * 60 * 24);
                    $status_class = 'ok';
                    $status_text = 'Válida';
                    
                    if ($days_to_expiry <= 0) {
                        $status_class = 'expired';
                        $status_text = 'VENCIDA';
                    } elseif ($days_to_expiry <= 30) {
                        $status_class = 'critical';
                        $status_text = 'CRÍTICO (' . round($days_to_expiry) . ' dias)';
                    } elseif ($days_to_expiry <= 60) {
                        $status_class = 'warning';
                        $status_text = 'ATENÇÃO (' . round($days_to_expiry) . ' dias)';
                    } else {
                        $status_text = round($days_to_expiry) . ' dias';
                    }
                    ?>
                    <tr>
                        <td>
                            <strong><?php echo esc_html($license->patient_name); ?></strong>
                            <?php if ($license->patient_phone): ?>
                                <br><small style="color: #666;"><?php echo esc_html($license->patient_phone); ?></small>
                            <?php endif; ?>
                        </td>
                        <td><strong><?php echo esc_html($license->license_number); ?></strong></td>
                        <td><?php echo esc_html($license->license_type); ?></td>
                        <td><?php echo date('d/m/Y', strtotime($license->issue_date)); ?></td>
                        <td><?php echo date('d/m/Y', strtotime($license->expiry_date)); ?></td>
                        <td><span class="license-status <?php echo $status_class; ?>"><?php echo $status_text; ?></span></td>
                        <td>
                            <a href="<?php echo admin_url('admin.php?page=be4hope-licenses&action=edit&id=' . $license->id); ?>" class="button button-small">Editar</a>
                            <a href="<?php echo admin_url('admin.php?page=be4hope-licenses&action=delete&id=' . $license->id); ?>" 
                               class="button button-small" 
                               onclick="return confirm('Tem certeza que deseja remover esta licença?')">Remover</a>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>
        
        <div style="margin-top: 30px; padding: 20px; background: #fff; border: 1px solid #c3c4c7; border-radius: 4px;">
            <h3 style="color: #E41B1C; margin: 0 0 15px 0;">📊 Estatísticas das Licenças</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
                <?php
                $total = count($licenses);
                $expired = count(array_filter($licenses, function($l) {
                    return strtotime($l->expiry_date) < time();
                }));
                $critical = count(array_filter($licenses, function($l) {
                    $days = (strtotime($l->expiry_date) - time()) / (60 * 60 * 24);
                    return $days > 0 && $days <= 30;
                }));
                $warning = count(array_filter($licenses, function($l) {
                    $days = (strtotime($l->expiry_date) - time()) / (60 * 60 * 24);
                    return $days > 30 && $days <= 60;
                }));
                $valid = $total - $expired - $critical - $warning;
                ?>
                <div style="text-align: center; padding: 15px; background: #f9f9f9; border-radius: 4px;">
                    <strong style="font-size: 24px; color: #E41B1C;"><?php echo $total; ?></strong>
                    <p style="margin: 5px 0 0 0;">Total</p>
                </div>
                <div style="text-align: center; padding: 15px; background: #fee2e2; border-radius: 4px;">
                    <strong style="font-size: 24px; color: #dc2626;"><?php echo $expired; ?></strong>
                    <p style="margin: 5px 0 0 0;">Vencidas</p>
                </div>
                <div style="text-align: center; padding: 15px; background: #fef3c7; border-radius: 4px;">
                    <strong style="font-size: 24px; color: #d97706;"><?php echo $critical; ?></strong>
                    <p style="margin: 5px 0 0 0;">Críticas</p>
                </div>
                <div style="text-align: center; padding: 15px; background: #dbeafe; border-radius: 4px;">
                    <strong style="font-size: 24px; color: #2563eb;"><?php echo $warning; ?></strong>
                    <p style="margin: 5px 0 0 0;">Atenção</p>
                </div>
                <div style="text-align: center; padding: 15px; background: #d1fae5; border-radius: 4px;">
                    <strong style="font-size: 24px; color: #059669;"><?php echo $valid; ?></strong>
                    <p style="margin: 5px 0 0 0;">Válidas</p>
                </div>
            </div>
        </div>
    </div>
    
    <style>
    .license-status {
        padding: 4px 8px;
        border-radius: 3px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
    }
    .license-status.ok {
        background: #d1fae5;
        color: #065f46;
    }
    .license-status.warning {
        background: #fef3c7;
        color: #92400e;
    }
    .license-status.critical {
        background: #fee2e2;
        color: #991b1b;
    }
    .license-status.expired {
        background: #1f2937;
        color: #ffffff;
    }
    </style>
    <?php
}

function show_license_form($action) {
    global $wpdb;
    $license = null;
    
    if ($action === 'edit' && isset($_GET['id'])) {
        $license = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}be4hope_licenses WHERE id = %d", intval($_GET['id'])));
    }
    
    $patients = $wpdb->get_results("SELECT id, name FROM {$wpdb->prefix}be4hope_patients WHERE status = 'active' ORDER BY name");
    ?>
    <div class="wrap">
        <h1><?php echo $action === 'add' ? 'Adicionar Licença ANVISA' : 'Editar Licença ANVISA'; ?></h1>
        
        <form method="post" action="">
            <?php wp_nonce_field('be4hope_license', 'nonce'); ?>
            <?php if ($action === 'edit'): ?>
                <input type="hidden" name="license_id" value="<?php echo $license->id; ?>">
            <?php endif; ?>
            
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 30px; max-width: 1200px;">
                
                <!-- Main License Info -->
                <div class="postbox">
                    <div class="postbox-header">
                        <h2 class="hndle">Informações da Licença</h2>
                    </div>
                    <div class="inside">
                        <table class="form-table">
                            <tr>
                                <th scope="row"><label for="patient_id">Paciente *</label></th>
                                <td>
                                    <select id="patient_id" name="patient_id" required class="regular-text">
                                        <option value="">Selecione um paciente</option>
                                        <?php foreach ($patients as $patient): ?>
                                            <option value="<?php echo $patient->id; ?>" 
                                                    <?php echo ($license && $license->patient_id == $patient->id) ? 'selected' : ''; ?>>
                                                <?php echo esc_html($patient->name); ?>
                                            </option>
                                        <?php endforeach; ?>
                                    </select>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row"><label for="license_number">Número da Licença *</label></th>
                                <td>
                                    <input type="text" id="license_number" name="license_number" required class="regular-text" 
                                           value="<?php echo $license ? esc_attr($license->license_number) : ''; ?>" 
                                           placeholder="Ex: 12345678901234567890">
                                    <p class="description">Número completo da licença ANVISA</p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row"><label for="license_type">Tipo de Licença *</label></th>
                                <td>
                                    <select id="license_type" name="license_type" required class="regular-text">
                                        <option value="">Selecione o tipo</option>
                                        <option value="Pessoa Física" <?php echo ($license && $license->license_type === 'Pessoa Física') ? 'selected' : ''; ?>>Pessoa Física</option>
                                        <option value="Pessoa Jurídica" <?php echo ($license && $license->license_type === 'Pessoa Jurídica') ? 'selected' : ''; ?>>Pessoa Jurídica</option>
                                        <option value="Importação" <?php echo ($license && $license->license_type === 'Importação') ? 'selected' : ''; ?>>Importação</option>
                                        <option value="Outros" <?php echo ($license && $license->license_type === 'Outros') ? 'selected' : ''; ?>>Outros</option>
                                    </select>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row"><label for="issuing_authority">Órgão Emissor</label></th>
                                <td>
                                    <input type="text" id="issuing_authority" name="issuing_authority" class="regular-text" 
                                           value="<?php echo $license ? esc_attr($license->issuing_authority) : 'ANVISA'; ?>" 
                                           placeholder="ANVISA">
                                </td>
                            </tr>
                        </table>
                    </div>
                </div>
                
                <!-- Dates and Status -->
                <div class="postbox">
                    <div class="postbox-header">
                        <h2 class="hndle">Datas e Validade</h2>
                    </div>
                    <div class="inside">
                        <table class="form-table">
                            <tr>
                                <th scope="row"><label for="issue_date">Data de Emissão *</label></th>
                                <td>
                                    <input type="date" id="issue_date" name="issue_date" required class="regular-text" 
                                           value="<?php echo $license ? esc_attr($license->issue_date) : ''; ?>">
                                </td>
                            </tr>
                            <tr>
                                <th scope="row"><label for="expiry_date">Data de Vencimento *</label></th>
                                <td>
                                    <input type="date" id="expiry_date" name="expiry_date" required class="regular-text" 
                                           value="<?php echo $license ? esc_attr($license->expiry_date) : ''; ?>">
                                    <p class="description">Alertas serão enviados 60 dias antes</p>
                                </td>
                            </tr>
                        </table>
                        
                        <div id="license-status" style="margin-top: 15px; padding: 10px; border-radius: 4px; display: none;">
                            <h4 style="margin: 0 0 5px 0;">Status da Licença</h4>
                            <p id="status-text" style="margin: 0; font-weight: bold;"></p>
                        </div>
                    </div>
                </div>
                
            </div>
            
            <!-- Notes -->
            <div class="postbox" style="max-width: 1200px; margin-top: 20px;">
                <div class="postbox-header">
                    <h2 class="hndle">Observações</h2>
                </div>
                <div class="inside">
                    <table class="form-table">
                        <tr>
                            <th scope="row"><label for="notes">Notas Adicionais</label></th>
                            <td>
                                <textarea id="notes" name="notes" rows="4" class="large-text" 
                                          placeholder="Observações sobre a licença, renovações anteriores, etc."><?php echo $license ? esc_textarea($license->notes) : ''; ?></textarea>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
            
            <p class="submit">
                <button type="submit" name="save_license" class="button button-primary">
                    <?php echo $action === 'add' ? 'Cadastrar Licença' : 'Atualizar Licença'; ?>
                </button>
                <a href="<?php echo admin_url('admin.php?page=be4hope-licenses'); ?>" class="button">Cancelar</a>
            </p>
        </form>
    </div>
    
    <script>
    jQuery(document).ready(function($) {
        // Check license status when expiry date changes
        $('#expiry_date').on('change', function() {
            const expiryDate = new Date($(this).val());
            const today = new Date();
            const diffTime = expiryDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let statusClass = 'ok';
            let statusText = 'Válida';
            let bgColor = '#d1fae5';
            let textColor = '#065f46';
            
            if (diffDays <= 0) {
                statusClass = 'expired';
                statusText = 'VENCIDA';
                bgColor = '#1f2937';
                textColor = '#ffffff';
            } else if (diffDays <= 30) {
                statusClass = 'critical';
                statusText = 'CRÍTICO - Vence em ' + diffDays + ' dias';
                bgColor = '#fee2e2';
                textColor = '#991b1b';
            } else if (diffDays <= 60) {
                statusClass = 'warning';
                statusText = 'ATENÇÃO - Vence em ' + diffDays + ' dias';
                bgColor = '#fef3c7';
                textColor = '#92400e';
            } else {
                statusText = 'Válida - Vence em ' + diffDays + ' dias';
            }
            
            $('#license-status').css({
                'background-color': bgColor,
                'color': textColor
            }).show();
            $('#status-text').text(statusText);
        });
        
        // Auto-calculate expiry date (1 year from issue date)
        $('#issue_date').on('change', function() {
            const issueDate = new Date($(this).val());
            if (issueDate && $('#expiry_date').val() === '') {
                const expiryDate = new Date(issueDate);
                expiryDate.setFullYear(expiryDate.getFullYear() + 1);
                $('#expiry_date').val(expiryDate.toISOString().split('T')[0]);
                $('#expiry_date').trigger('change');
            }
        });
        
        // Trigger status check on page load if editing
        <?php if ($action === 'edit' && $license): ?>
            $('#expiry_date').trigger('change');
        <?php endif; ?>
    });
    </script>
    <?php
}
?>
