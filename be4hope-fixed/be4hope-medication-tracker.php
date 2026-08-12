<?php
/**
 * Plugin Name: Be4Hope Medication Tracker
 * Description: Sistema completo de acompanhamento de medicação à base de canabidiol
 * Version: 1.0.0
 * Author: Manus AI
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define constants
define('BE4HOPE_VERSION', '1.0.0');
define('BE4HOPE_DIR', plugin_dir_path(__FILE__));
define('BE4HOPE_URL', plugin_dir_url(__FILE__));

class Be4HopeMedicationTracker {
    
    public function __construct() {
        add_action('init', array($this, 'init'));
        add_action('admin_menu', array($this, 'admin_menu'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
        
        // AJAX handlers
        add_action('wp_ajax_be4hope_save_patient', array($this, 'ajax_save_patient'));
        add_action('wp_ajax_be4hope_save_medication', array($this, 'ajax_save_medication'));
        add_action('wp_ajax_be4hope_calculate_dosage', array($this, 'ajax_calculate_dosage'));
        add_action('wp_ajax_be4hope_send_test_email', array($this, 'ajax_send_test_email'));
        add_action('wp_ajax_be4hope_send_admin_alert_test', array($this, 'ajax_send_admin_alert_test'));
        
        // Activation hook
        register_activation_hook(__FILE__, array($this, 'activate'));
        
        // Include admin alerts system
        include_once plugin_dir_path(__FILE__) . 'includes/admin-alerts.php';
    }
    
    public function init() {
        // Initialize plugin
    }
    
    public function admin_menu() {
        add_menu_page(
            'Be4Hope',
            'Be4Hope',
            'manage_options',
            'be4hope-dashboard',
            array($this, 'dashboard_page'),
            'dashicons-heart',
            30
        );
        
        add_submenu_page(
            'be4hope-dashboard',
            'Dashboard',
            'Dashboard',
            'manage_options',
            'be4hope-dashboard',
            array($this, 'dashboard_page')
        );
        
        add_submenu_page(
            'be4hope-dashboard',
            'Pacientes',
            'Pacientes',
            'manage_options',
            'be4hope-patients',
            array($this, 'patients_page')
        );
        
        add_submenu_page(
            'be4hope-dashboard',
            'Medicações',
            'Medicações',
            'manage_options',
            'be4hope-medications',
            array($this, 'medications_page')
        );
        
        add_submenu_page(
            'be4hope-dashboard',
            'Produtos',
            'Produtos',
            'manage_options',
            'be4hope-products',
            array($this, 'products_page')
        );
        
        add_submenu_page(
            'be4hope-dashboard',
            'Licenças ANVISA',
            'Licenças ANVISA',
            'manage_options',
            'be4hope-licenses',
            array($this, 'licenses_page')
        );
        
        add_submenu_page(
            'be4hope-dashboard',
            'Calculadora',
            'Calculadora',
            'manage_options',
            'be4hope-calculator',
            array($this, 'calculator_page')
        );
        
        add_submenu_page(
            'be4hope-dashboard',
            'Configurações de Email',
            'Config. Email',
            'manage_options',
            'be4hope-email-settings',
            array($this, 'email_settings_page')
        );
    }
    
    public function enqueue_admin_scripts($hook) {
        if (strpos($hook, 'be4hope') !== false) {
            wp_enqueue_style('be4hope-admin-style', BE4HOPE_URL . 'assets/admin-style.css', array(), BE4HOPE_VERSION);
            wp_enqueue_script('be4hope-admin-script', BE4HOPE_URL . 'assets/admin-script.js', array('jquery'), BE4HOPE_VERSION, true);
            
            wp_localize_script('be4hope-admin-script', 'be4hope_ajax', array(
                'ajax_url' => admin_url('admin-ajax.php'),
                'nonce' => wp_create_nonce('be4hope_nonce')
            ));
        }
    }
    
    public function dashboard_page() {
        ?>
        <div class="wrap">
            <h1>Dashboard Be4Hope</h1>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0;">
                <div style="background: #fff; border: 1px solid #c3c4c7; border-left: 4px solid #2271b1; padding: 20px; text-align: center;">
                    <h3 style="margin: 0; font-size: 2em;">
                        <?php echo $this->get_patients_count(); ?>
                    </h3>
                    <p style="margin: 10px 0 0 0;">Pacientes Ativos</p>
                </div>
                
                <div style="background: #fff; border: 1px solid #c3c4c7; border-left: 4px solid #00a32a; padding: 20px; text-align: center;">
                    <h3 style="margin: 0; font-size: 2em;">
                        <?php echo $this->get_medications_count(); ?>
                    </h3>
                    <p style="margin: 10px 0 0 0;">Medicações Ativas</p>
                </div>
                
                <div style="background: #fff; border: 1px solid #c3c4c7; border-left: 4px solid #dba617; padding: 20px; text-align: center;">
                    <h3 style="margin: 0; font-size: 2em;">
                        <?php echo $this->get_critical_alerts(); ?>
                    </h3>
                    <p style="margin: 10px 0 0 0;">Alertas Críticos</p>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
                <div style="background: #fff; border: 1px solid #c3c4c7; padding: 20px;">
                    <h2>Ações Rápidas</h2>
                    <p><a href="<?php echo admin_url('admin.php?page=be4hope-patients&action=add'); ?>" class="button button-primary">Adicionar Paciente</a></p>
                    <p><a href="<?php echo admin_url('admin.php?page=be4hope-medications&action=add'); ?>" class="button button-primary">Adicionar Medicação</a></p>
                    <p><a href="<?php echo admin_url('admin.php?page=be4hope-calculator'); ?>" class="button">Calculadora de Dosagem</a></p>
                </div>
                
                <div style="background: #fff; border: 1px solid #c3c4c7; padding: 20px;">
                    <h2>Alertas Recentes</h2>
                    <?php $this->show_recent_alerts(); ?>
                </div>
            </div>
        </div>
        <?php
    }
    
    public function patients_page() {
        $action = isset($_GET['action']) ? $_GET['action'] : 'list';
        
        if ($action === 'list') {
            $this->show_patients_list();
        } elseif ($action === 'add' || $action === 'edit') {
            $this->show_patient_form($action);
        }
    }
    
    public function medications_page() {
        $action = isset($_GET['action']) ? $_GET['action'] : 'list';
        
        if ($action === 'list') {
            $this->show_medications_list();
        } elseif ($action === 'add' || $action === 'edit') {
            $this->show_medication_form($action);
        }
    }
    
    public function products_page() {
        include_once plugin_dir_path(__FILE__) . 'includes/products.php';
    }
    
    public function licenses_page() {
        include_once plugin_dir_path(__FILE__) . 'includes/anvisa-licenses.php';
    }
    
    public function email_settings_page() {
        include_once plugin_dir_path(__FILE__) . 'includes/email-settings.php';
    }
    
    public function calculator_page() {
        ?>
        <div class="wrap">
            <h1>Calculadora de Dosagem</h1>
            
            <div style="max-width: 800px;">
                <div style="background: #fff; border: 1px solid #c3c4c7; padding: 20px; margin: 20px 0;">
                    <form id="dosage-calculator-form">
                        <table class="form-table">
                            <tr>
                                <th scope="row"><label for="patient_weight">Peso do Paciente (kg)</label></th>
                                <td><input type="number" id="patient_weight" name="weight" min="1" max="200" required class="regular-text"></td>
                            </tr>
                            <tr>
                                <th scope="row"><label for="patient_age">Idade</label></th>
                                <td>
                                    <select id="patient_age" name="age_group" required class="regular-text">
                                        <option value="">Selecione</option>
                                        <option value="child">Criança (3-11 anos)</option>
                                        <option value="teen">Adolescente (12-17 anos)</option>
                                        <option value="adult">Adulto (18-65 anos)</option>
                                        <option value="elderly">Idoso (65+ anos)</option>
                                    </select>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row"><label for="experience_level">Nível de Experiência</label></th>
                                <td>
                                    <select id="experience_level" name="experience" required class="regular-text">
                                        <option value="">Selecione</option>
                                        <option value="beginner">Iniciante</option>
                                        <option value="intermediate">Intermediário</option>
                                        <option value="advanced">Avançado</option>
                                    </select>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row"><label for="product_select">Produto</label></th>
                                <td>
                                    <select id="product_select" name="product" required class="regular-text">
                                        <option value="">Selecione o produto</option>
                                        <option value="greens_med_6300">Greens MED 6300mg Full Spectrum</option>
                                        <option value="greens_med_9000">Greens MED 9000mg Broad Spectrum</option>
                                        <option value="greens_life_6000">Greens LIFE 6000mg Isolated</option>
                                        <option value="greens_life_1500_isolated">Greens LIFE 1500mg Isolated</option>
                                        <option value="greens_life_1500_broad">Greens LIFE 1500mg Broad Spectrum</option>
                                        <option value="greens_life_1500_full">Greens LIFE 1500mg Full Spectrum</option>
                                    </select>
                                </td>
                            </tr>
                        </table>
                        
                        <p>
                            <button type="button" id="calculate-dosage" class="button button-primary">Calcular Dosagem</button>
                        </p>
                    </form>
                    
                    <div id="dosage-result" style="display: none; background: #e7f3ff; padding: 15px; border-radius: 4px; margin-top: 20px;">
                        <h3>Resultado do Cálculo</h3>
                        <div id="dosage-details"></div>
                    </div>
                </div>
            </div>
        </div>
        <?php
    }
    
    private function show_patients_list() {
        global $wpdb;
        $patients = $wpdb->get_results("SELECT * FROM {$wpdb->prefix}be4hope_patients WHERE status = 'active' ORDER BY created_at DESC");
        ?>
        <div class="wrap">
            <h1>
                Pacientes
                <a href="<?php echo admin_url('admin.php?page=be4hope-patients&action=add'); ?>" class="page-title-action">Adicionar Novo</a>
            </h1>
            
            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Email</th>
                        <th>Telefone</th>
                        <th>Data Cadastro</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($patients as $patient): ?>
                    <tr>
                        <td><strong><?php echo esc_html($patient->name); ?></strong></td>
                        <td><?php echo esc_html($patient->email); ?></td>
                        <td><?php echo esc_html($patient->phone); ?></td>
                        <td><?php echo date('d/m/Y', strtotime($patient->created_at)); ?></td>
                        <td>
                            <a href="<?php echo admin_url('admin.php?page=be4hope-patients&action=edit&id=' . $patient->id); ?>" class="button button-small">Editar</a>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?php
    }
    
    private function show_patient_form($action) {
        $patient = null;
        if ($action === 'edit' && isset($_GET['id'])) {
            global $wpdb;
            $patient = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}be4hope_patients WHERE id = %d", intval($_GET['id'])));
        }
        ?>
        <div class="wrap">
            <h1><?php echo $action === 'add' ? 'Adicionar Paciente' : 'Editar Paciente'; ?></h1>
            
            <form id="patient-form" method="post">
                <?php wp_nonce_field('be4hope_nonce', 'nonce'); ?>
                <?php if ($action === 'edit'): ?>
                    <input type="hidden" name="patient_id" value="<?php echo $patient->id; ?>">
                <?php endif; ?>
                
                <table class="form-table">
                    <tr>
                        <th scope="row"><label for="name">Nome Completo *</label></th>
                        <td><input type="text" id="name" name="name" required class="regular-text" value="<?php echo $patient ? esc_attr($patient->name) : ''; ?>"></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="email">Email *</label></th>
                        <td><input type="email" id="email" name="email" required class="regular-text" value="<?php echo $patient ? esc_attr($patient->email) : ''; ?>"></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="phone">Telefone</label></th>
                        <td><input type="text" id="phone" name="phone" class="regular-text" value="<?php echo $patient ? esc_attr($patient->phone) : ''; ?>"></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="birth_date">Data de Nascimento</label></th>
                        <td><input type="date" id="birth_date" name="birth_date" class="regular-text" value="<?php echo $patient ? esc_attr($patient->birth_date) : ''; ?>"></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="weight">Peso (kg)</label></th>
                        <td><input type="number" id="weight" name="weight" min="1" max="200" step="0.1" class="regular-text" value="<?php echo $patient ? esc_attr($patient->weight) : ''; ?>"></td>
                    </tr>
                </table>
                
                <p class="submit">
                    <button type="submit" class="button button-primary"><?php echo $action === 'add' ? 'Cadastrar' : 'Atualizar'; ?></button>
                    <a href="<?php echo admin_url('admin.php?page=be4hope-patients'); ?>" class="button">Cancelar</a>
                </p>
            </form>
        </div>
        <?php
    }
    
    private function show_medications_list() {
        global $wpdb;
        $medications = $wpdb->get_results("
            SELECT m.*, p.name as patient_name
            FROM {$wpdb->prefix}be4hope_medications m
            LEFT JOIN {$wpdb->prefix}be4hope_patients p ON m.patient_id = p.id
            WHERE m.status = 'active'
            ORDER BY m.created_at DESC
        ");
        ?>
        <div class="wrap">
            <h1>
                Medicações
                <a href="<?php echo admin_url('admin.php?page=be4hope-medications&action=add'); ?>" class="page-title-action">Adicionar Nova</a>
            </h1>
            
            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th>Paciente</th>
                        <th>Produto</th>
                        <th>Dosagem Diária</th>
                        <th>Data Início</th>
                        <th>Previsão Fim</th>
                        <th>Status</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($medications as $med): ?>
                    <?php
                    $days_remaining = (strtotime($med->estimated_end_date) - time()) / (60 * 60 * 24);
                    $status_class = $days_remaining <= 10 ? 'critical' : ($days_remaining <= 30 ? 'warning' : 'ok');
                    $status_text = $days_remaining <= 0 ? 'Terminada' : round($days_remaining) . ' dias';
                    ?>
                    <tr>
                        <td><strong><?php echo esc_html($med->patient_name); ?></strong></td>
                        <td><?php echo esc_html($med->product_name); ?></td>
                        <td><?php echo $med->daily_drops; ?> gotas/dia</td>
                        <td><?php echo date('d/m/Y', strtotime($med->start_date)); ?></td>
                        <td><?php echo date('d/m/Y', strtotime($med->estimated_end_date)); ?></td>
                        <td><span class="status-badge <?php echo $status_class; ?>"><?php echo $status_text; ?></span></td>
                        <td>
                            <a href="<?php echo admin_url('admin.php?page=be4hope-medications&action=edit&id=' . $med->id); ?>" class="button button-small">Editar</a>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?php
    }
    
    private function show_medication_form($action) {
        global $wpdb;
        $medication = null;
        if ($action === 'edit' && isset($_GET['id'])) {
            $medication = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}be4hope_medications WHERE id = %d", intval($_GET['id'])));
        }
        
        $patients = $wpdb->get_results("SELECT id, name FROM {$wpdb->prefix}be4hope_patients WHERE status = 'active' ORDER BY name");
        $products = $wpdb->get_results("SELECT id, name, brand, total_drops, cbd_mg_per_drop, has_nanotechnology FROM {$wpdb->prefix}be4hope_products WHERE status = 'active' ORDER BY brand, name");
        ?>
        <div class="wrap">
            <h1><?php echo $action === 'add' ? 'Adicionar Medicação' : 'Editar Medicação'; ?></h1>
            
            <form id="medication-form" method="post">
                <?php wp_nonce_field('be4hope_nonce', 'nonce'); ?>
                <?php if ($action === 'edit'): ?>
                    <input type="hidden" name="medication_id" value="<?php echo $medication->id; ?>">
                <?php endif; ?>
                
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 30px; max-width: 1200px;">
                    
                    <!-- Main Form -->
                    <div class="postbox">
                        <div class="postbox-header">
                            <h2 class="hndle">Informações da Medicação</h2>
                        </div>
                        <div class="inside">
                            <table class="form-table">
                                <tr>
                                    <th scope="row"><label for="patient_id">Paciente *</label></th>
                                    <td>
                                        <select id="patient_id" name="patient_id" required class="regular-text">
                                            <option value="">Selecione um paciente</option>
                                            <?php foreach ($patients as $patient): ?>
                                                <option value="<?php echo $patient->id; ?>" <?php echo ($medication && $medication->patient_id == $patient->id) ? 'selected' : ''; ?>>
                                                    <?php echo esc_html($patient->name); ?>
                                                </option>
                                            <?php endforeach; ?>
                                        </select>
                                    </td>
                                </tr>
                                <tr>
                                    <th scope="row"><label for="product_id">Produto *</label></th>
                                    <td>
                                        <select id="product_id" name="product_id" required class="regular-text">
                                            <option value="">Selecione um produto</option>
                                            <?php foreach ($products as $product): ?>
                                                <option value="<?php echo $product->id; ?>" 
                                                        data-name="<?php echo esc_attr($product->name); ?>"
                                                        data-total-drops="<?php echo $product->total_drops; ?>"
                                                        data-cbd-per-drop="<?php echo $product->cbd_mg_per_drop; ?>"
                                                        data-has-nano="<?php echo $product->has_nanotechnology; ?>"
                                                        <?php echo ($medication && $medication->product_id == $product->id) ? 'selected' : ''; ?>>
                                                    <?php echo esc_html($product->name); ?>
                                                    <?php if ($product->has_nanotechnology): ?>
                                                        (NANO)
                                                    <?php endif; ?>
                                                </option>
                                            <?php endforeach; ?>
                                        </select>
                                        <input type="hidden" id="product_name" name="product_name" value="<?php echo $medication ? esc_attr($medication->product_name) : ''; ?>">
                                        <p class="description">Selecione o produto cadastrado para cálculos precisos</p>
                                    </td>
                                </tr>
                                <tr>
                                    <th scope="row"><label for="daily_drops">Gotas por Dia *</label></th>
                                    <td>
                                        <input type="number" id="daily_drops" name="daily_drops" min="1" max="100" required class="regular-text" 
                                               value="<?php echo $medication ? esc_attr($medication->daily_drops) : ''; ?>">
                                        <p class="description">Número de gotas que o paciente tomará por dia</p>
                                    </td>
                                </tr>
                                <tr>
                                    <th scope="row"><label for="start_date">Data de Início *</label></th>
                                    <td>
                                        <input type="date" id="start_date" name="start_date" required class="regular-text" 
                                               value="<?php echo $medication ? esc_attr($medication->start_date) : date('Y-m-d'); ?>">
                                    </td>
                                </tr>
                                <tr>
                                    <th scope="row"><label for="bottle_count">Quantidade de Frascos</label></th>
                                    <td>
                                        <input type="number" id="bottle_count" name="bottle_count" min="1" max="50" class="regular-text" 
                                               value="<?php echo $medication ? esc_attr($medication->bottle_count) : '1'; ?>">
                                        <p class="description">Quantos frascos o paciente comprou</p>
                                    </td>
                                </tr>
                            </table>
                        </div>
                    </div>
                    
                    <!-- Calculation Preview -->
                    <div class="postbox">
                        <div class="postbox-header">
                            <h2 class="hndle">Previsão de Duração</h2>
                        </div>
                        <div class="inside">
                            <div id="duration-preview" style="display: none;">
                                <div style="text-align: center; padding: 20px; background: #f9f9f9; border-radius: 4px; margin-bottom: 15px;">
                                    <h3 style="margin: 0; color: #E41B1C;" id="duration-days">-- dias</h3>
                                    <p style="margin: 5px 0 0 0;">Duração estimada</p>
                                </div>
                                
                                <div style="margin-bottom: 15px;">
                                    <strong>Produto:</strong> <span id="preview-product">--</span><br>
                                    <strong>Total de gotas:</strong> <span id="preview-total-drops">--</span><br>
                                    <strong>Gotas por dia:</strong> <span id="preview-daily-drops">--</span><br>
                                    <strong>Frascos:</strong> <span id="preview-bottles">--</span>
                                </div>
                                
                                <div style="background: #e7f3ff; padding: 10px; border-radius: 4px; font-size: 12px;">
                                    <strong>Alertas automáticos:</strong><br>
                                    • <span id="alert-40-days">--</span> (40 dias antes)<br>
                                    • <span id="alert-30-days">--</span> (30 dias antes)<br>
                                    • <span id="alert-10-days">--</span> (10 dias antes)
                                </div>
                            </div>
                            
                            <div id="no-calculation" style="text-align: center; padding: 30px; color: #666;">
                                <p>Selecione um produto e informe a dosagem para ver a previsão</p>
                            </div>
                        </div>
                    </div>
                    
                </div>
                
                <p class="submit">
                    <button type="submit" class="button button-primary"><?php echo $action === 'add' ? 'Cadastrar' : 'Atualizar'; ?></button>
                    <a href="<?php echo admin_url('admin.php?page=be4hope-medications'); ?>" class="button">Cancelar</a>
                </p>
            </form>
        </div>
        
        <script>
        jQuery(document).ready(function($) {
            // Update product name when product is selected
            $('#product_id').on('change', function() {
                const selectedOption = $(this).find('option:selected');
                const productName = selectedOption.data('name') || '';
                $('#product_name').val(productName);
                
                updateDurationPreview();
            });
            
            // Update preview when dosage or bottles change
            $('#daily_drops, #bottle_count, #start_date').on('input change', function() {
                updateDurationPreview();
            });
            
            function updateDurationPreview() {
                const productSelect = $('#product_id');
                const selectedOption = productSelect.find('option:selected');
                const dailyDrops = parseInt($('#daily_drops').val()) || 0;
                const bottleCount = parseInt($('#bottle_count').val()) || 1;
                const startDate = $('#start_date').val();
                
                if (!selectedOption.val() || !dailyDrops || !startDate) {
                    $('#duration-preview').hide();
                    $('#no-calculation').show();
                    return;
                }
                
                const totalDropsPerBottle = parseInt(selectedOption.data('total-drops')) || 0;
                const productName = selectedOption.data('name') || '';
                const hasNano = selectedOption.data('has-nano') == 1;
                
                if (totalDropsPerBottle > 0) {
                    const totalDrops = totalDropsPerBottle * bottleCount;
                    const durationDays = Math.floor(totalDrops / dailyDrops);
                    
                    // Calculate alert dates
                    const startDateObj = new Date(startDate);
                    const endDate = new Date(startDateObj);
                    endDate.setDate(endDate.getDate() + durationDays);
                    
                    const alert40 = new Date(endDate);
                    alert40.setDate(alert40.getDate() - 40);
                    
                    const alert30 = new Date(endDate);
                    alert30.setDate(alert30.getDate() - 30);
                    
                    const alert10 = new Date(endDate);
                    alert10.setDate(alert10.getDate() - 10);
                    
                    // Update preview
                    $('#duration-days').text(durationDays + ' dias');
                    $('#preview-product').text(productName + (hasNano ? ' (NANO)' : ''));
                    $('#preview-total-drops').text(totalDrops.toLocaleString() + ' gotas');
                    $('#preview-daily-drops').text(dailyDrops + ' gotas');
                    $('#preview-bottles').text(bottleCount + ' frasco(s)');
                    
                    $('#alert-40-days').text(alert40.toLocaleDateString('pt-BR'));
                    $('#alert-30-days').text(alert30.toLocaleDateString('pt-BR'));
                    $('#alert-10-days').text(alert10.toLocaleDateString('pt-BR'));
                    
                    $('#duration-preview').show();
                    $('#no-calculation').hide();
                } else {
                    $('#duration-preview').hide();
                    $('#no-calculation').show();
                }
            }
            
            // Trigger calculation on page load if editing
            <?php if ($action === 'edit' && $medication): ?>
                updateDurationPreview();
            <?php endif; ?>
        });
        </script>
        <?php
    }
    
    // AJAX Handlers
    public function ajax_save_patient() {
        check_ajax_referer('be4hope_nonce', 'nonce');
        
        global $wpdb;
        
        $data = array(
            'name' => sanitize_text_field($_POST['name']),
            'email' => sanitize_email($_POST['email']),
            'phone' => sanitize_text_field($_POST['phone']),
            'birth_date' => sanitize_text_field($_POST['birth_date']),
            'weight' => floatval($_POST['weight'])
        );
        
        if (isset($_POST['patient_id']) && !empty($_POST['patient_id'])) {
            // Update
            $result = $wpdb->update(
                $wpdb->prefix . 'be4hope_patients',
                $data,
                array('id' => intval($_POST['patient_id']))
            );
        } else {
            // Insert
            $data['created_at'] = current_time('mysql');
            $result = $wpdb->insert($wpdb->prefix . 'be4hope_patients', $data);
        }
        
        if ($result !== false) {
            wp_send_json_success('Paciente salvo com sucesso!');
        } else {
            wp_send_json_error('Erro ao salvar paciente.');
        }
    }
    
    public function ajax_save_medication() {
        check_ajax_referer('be4hope_nonce', 'nonce');
        
        global $wpdb;
        
        $product_id = intval($_POST['product_id']);
        $daily_drops = intval($_POST['daily_drops']);
        $bottle_count = intval($_POST['bottle_count']);
        $start_date = sanitize_text_field($_POST['start_date']);
        
        // Get product details for accurate calculation
        $product = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}be4hope_products WHERE id = %d", $product_id));
        
        if (!$product) {
            wp_send_json_error('Produto não encontrado.');
            return;
        }
        
        // Calculate estimated end date using real product data
        $total_drops = $product->total_drops * $bottle_count;
        $duration_days = floor($total_drops / $daily_drops);
        $estimated_end_date = date('Y-m-d', strtotime($start_date . ' + ' . $duration_days . ' days'));
        
        $data = array(
            'patient_id' => intval($_POST['patient_id']),
            'product_id' => $product_id,
            'product_name' => $product->name,
            'daily_drops' => $daily_drops,
            'bottle_count' => $bottle_count,
            'start_date' => $start_date,
            'estimated_end_date' => $estimated_end_date,
            'notification_40_days' => date('Y-m-d', strtotime($estimated_end_date . ' - 40 days')),
            'notification_30_days' => date('Y-m-d', strtotime($estimated_end_date . ' - 30 days')),
            'notification_10_days' => date('Y-m-d', strtotime($estimated_end_date . ' - 10 days'))
        );
        
        if (isset($_POST['medication_id']) && !empty($_POST['medication_id'])) {
            // Update
            $result = $wpdb->update(
                $wpdb->prefix . 'be4hope_medications',
                $data,
                array('id' => intval($_POST['medication_id']))
            );
            $message = 'Medicação atualizada com sucesso!';
        } else {
            // Insert
            $data['created_at'] = current_time('mysql');
            $result = $wpdb->insert($wpdb->prefix . 'be4hope_medications', $data);
            $message = 'Medicação cadastrada com sucesso!';
        }
        
        if ($result !== false) {
            wp_send_json_success(array(
                'message' => $message,
                'duration_days' => $duration_days,
                'estimated_end_date' => date('d/m/Y', strtotime($estimated_end_date)),
                'total_drops' => $total_drops
            ));
        } else {
            wp_send_json_error('Erro ao salvar medicação.');
        }
    }
    
    public function ajax_calculate_dosage() {
        check_ajax_referer('be4hope_nonce', 'nonce');
        
        $weight = floatval($_POST['weight']);
        $age_group = sanitize_text_field($_POST['age_group']);
        $experience = sanitize_text_field($_POST['experience']);
        $product = sanitize_text_field($_POST['product']);
        
        // Dosage calculation logic
        $dosage_ranges = array(
            'child' => array('min' => 0.5, 'max' => 5.0),
            'teen' => array('min' => 0.3, 'max' => 2.0),
            'adult' => array('min' => 0.25, 'max' => 2.0),
            'elderly' => array('min' => 0.2, 'max' => 1.5)
        );
        
        $experience_multipliers = array(
            'beginner' => 0.5,
            'intermediate' => 1.0,
            'advanced' => 1.5
        );
        
        $range = $dosage_ranges[$age_group];
        $multiplier = $experience_multipliers[$experience];
        
        $base_dosage = $range['min'] * $multiplier;
        $max_dosage = $range['max'] * $multiplier;
        
        $daily_cbd = $weight * $base_dosage;
        $max_daily_cbd = $weight * $max_dosage;
        
        // Product concentrations (mg CBD per drop)
        $products = array(
            'greens_med_6300' => 6.66,
            'greens_med_9000' => 10.0,
            'greens_life_6000' => 6.66,
            'greens_life_1500_isolated' => 1.66,
            'greens_life_1500_broad' => 1.66,
            'greens_life_1500_full' => 1.66
        );
        
        $cbd_per_drop = $products[$product];
        $daily_drops = round($daily_cbd / $cbd_per_drop);
        $max_daily_drops = round($max_daily_cbd / $cbd_per_drop);
        
        $result = array(
            'daily_cbd' => round($daily_cbd, 2),
            'max_daily_cbd' => round($max_daily_cbd, 2),
            'daily_drops' => $daily_drops,
            'max_daily_drops' => $max_daily_drops,
            'drops_per_dose' => round($daily_drops / 2),
            'product_concentration' => $cbd_per_drop
        );
        
        wp_send_json_success($result);
    }
    
    public function ajax_send_test_email() {
        check_ajax_referer('be4hope_nonce', 'nonce');
        
        $to = sanitize_email($_POST['email_to']);
        $message = sanitize_textarea_field($_POST['message']);
        $subject = 'Teste de Email - Be4Hope System';
        
        // Get email settings
        $from_name = get_option('be4hope_email_from_name', get_bloginfo('name'));
        $from_email = get_option('be4hope_email_from_address', get_option('admin_email'));
        
        // Setup headers
        $headers = array();
        $headers[] = 'Content-Type: text/html; charset=UTF-8';
        $headers[] = 'From: ' . $from_name . ' <' . $from_email . '>';
        
        // Setup SMTP if enabled
        if (get_option('be4hope_smtp_enabled', 0)) {
            add_action('phpmailer_init', array($this, 'configure_smtp'));
        }
        
        // Create HTML message
        $html_message = $this->create_email_template($subject, $message);
        
        // Send email
        $result = wp_mail($to, $subject, $html_message, $headers);
        
        // Update test status
        update_option('be4hope_last_email_test', time());
        update_option('be4hope_last_email_test_result', $result ? 'success' : 'error');
        
        if ($result) {
            wp_send_json_success('Email de teste enviado com sucesso para ' . $to);
        } else {
            wp_send_json_error('Falha ao enviar email. Verifique as configurações.');
        }
    }
    
    public function ajax_send_admin_alert_test() {
        check_ajax_referer('be4hope_nonce', 'nonce');
        
        $admin_email = get_option('be4hope_admin_email', get_option('admin_email'));
        
        // Create sample alert data for testing
        $sample_alerts = array(
            array(
                'type' => 'medication',
                'priority' => 'critical',
                'patient_name' => 'João Silva (TESTE)',
                'patient_phone' => '(11) 99999-9999',
                'product_name' => 'Greens MED 6300mg Full Spectrum',
                'days_remaining' => 8,
                'end_date' => date('Y-m-d', strtotime('+8 days'))
            ),
            array(
                'type' => 'medication',
                'priority' => 'high',
                'patient_name' => 'Maria Santos (TESTE)',
                'patient_phone' => '(11) 88888-8888',
                'product_name' => 'Greens LIFE 1500mg Isolated',
                'days_remaining' => 25,
                'end_date' => date('Y-m-d', strtotime('+25 days'))
            )
        );
        
        // Create test email content
        $content = '<h2 style="color: #E41B1C; margin-bottom: 20px;">🚨 TESTE DE ALERTAS ADMINISTRATIVOS</h2>';
        $content .= '<div style="background: #e7f3ff; padding: 15px; border-radius: 4px; margin: 15px 0;">';
        $content .= '<p><strong>Este é um email de teste do sistema de alertas Be4Hope.</strong></p>';
        $content .= '<p>Se você recebeu esta mensagem, o sistema de alertas automáticos está funcionando corretamente!</p>';
        $content .= '</div>';
        
        $content .= '<div style="background: #fee2e2; border-left: 4px solid #E41B1C; padding: 15px; margin: 15px 0; border-radius: 4px;">';
        $content .= '<h3 style="color: #E41B1C; margin: 0 0 10px 0;">🔴 EXEMPLO - CRÍTICO</h3>';
        foreach ($sample_alerts as $alert) {
            if ($alert['priority'] === 'critical') {
                $content .= '<div style="margin: 10px 0; padding: 10px; background: white; border-radius: 4px;">';
                $content .= '<strong>' . esc_html($alert['patient_name']) . '</strong><br>';
                $content .= 'Produto: ' . esc_html($alert['product_name']) . '<br>';
                $content .= 'Termina em: <strong style="color: #E41B1C;">' . $alert['days_remaining'] . ' dias</strong> (' . date('d/m/Y', strtotime($alert['end_date'])) . ')<br>';
                $content .= 'Telefone: ' . esc_html($alert['patient_phone']) . '<br>';
                $content .= '</div>';
            }
        }
        $content .= '</div>';
        
        $content .= '<div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; border-radius: 4px;">';
        $content .= '<h3 style="color: #f59e0b; margin: 0 0 10px 0;">🟡 EXEMPLO - ATENÇÃO</h3>';
        foreach ($sample_alerts as $alert) {
            if ($alert['priority'] === 'high') {
                $content .= '<div style="margin: 10px 0; padding: 10px; background: white; border-radius: 4px;">';
                $content .= '<strong>' . esc_html($alert['patient_name']) . '</strong><br>';
                $content .= 'Produto: ' . esc_html($alert['product_name']) . '<br>';
                $content .= 'Termina em: ' . $alert['days_remaining'] . ' dias (' . date('d/m/Y', strtotime($alert['end_date'])) . ')<br>';
                $content .= 'Telefone: ' . esc_html($alert['patient_phone']) . '<br>';
                $content .= '</div>';
            }
        }
        $content .= '</div>';
        
        $subject = '🧪 TESTE - Alertas Be4Hope';
        
        $result = $this->send_admin_email($admin_email, $subject, $content);
        
        if ($result) {
            update_option('be4hope_last_test_sent', current_time('mysql'));
            wp_send_json_success('Teste de alerta administrativo enviado com sucesso para ' . $admin_email);
        } else {
            wp_send_json_error('Falha ao enviar teste de alerta. Verifique as configurações de email.');
        }
    }
    
    public function send_admin_email($to, $subject, $content) {
        $from_name = get_option('be4hope_email_from_name', 'Be4Hope System');
        $from_email = get_option('be4hope_email_from_address', get_option('admin_email'));
        
        $headers = array();
        $headers[] = 'Content-Type: text/html; charset=UTF-8';
        $headers[] = 'From: ' . $from_name . ' <' . $from_email . '>';
        
        // Setup SMTP if enabled
        if (get_option('be4hope_smtp_enabled', 0)) {
            add_action('phpmailer_init', array($this, 'configure_smtp'));
        }
        
        $html_message = $this->create_admin_email_template($subject, $content);
        
        return wp_mail($to, $subject, $html_message, $headers);
    }
    
    private function create_admin_email_template($subject, $content) {
        $company_name = get_option('be4hope_email_from_name', 'Be4Hope');
        $site_url = get_site_url();
        $admin_url = admin_url('admin.php?page=be4hope-dashboard');
        
        return "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset='UTF-8'>
            <meta name='viewport' content='width=device-width, initial-scale=1.0'>
            <title>{$subject}</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
                .container { max-width: 700px; margin: 0 auto; padding: 20px; }
                .header { background: #E41B1C; color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
                .header h1 { margin: 0; font-size: 24px; }
                .content { background: #fff; padding: 30px; border: 1px solid #ddd; min-height: 200px; }
                .footer { background: #f9f9f9; padding: 20px; text-align: center; font-size: 14px; color: #666; border-radius: 0 0 8px 8px; border: 1px solid #ddd; border-top: none; }
                .button { display: inline-block; background: #E41B1C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 15px 0; font-weight: bold; }
                .button:hover { background: #c41517; }
                .alert-summary { background: #E41B1C; color: white; padding: 15px; border-radius: 4px; margin: 20px 0; text-align: center; }
                .timestamp { color: #666; font-size: 12px; margin-top: 20px; text-align: center; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <h1>🚨 {$company_name}</h1>
                    <p style='margin: 5px 0 0 0; font-size: 16px;'>Sistema de Alertas Administrativos</p>
                </div>
                <div class='content'>
                    {$content}
                    
                    <div style='text-align: center; margin-top: 30px;'>
                        <a href='{$admin_url}' class='button'>🔗 Acessar Dashboard</a>
                    </div>
                    
                    <div class='timestamp'>
                        📅 Enviado em " . date('d/m/Y H:i:s') . "
                    </div>
                </div>
                <div class='footer'>
                    <p><strong>Este é um alerta automático do sistema {$company_name}</strong></p>
                    <p>Para configurar alertas, acesse: <a href='{$admin_url}' style='color: #E41B1C;'>Painel Administrativo</a></p>
                    <p><a href='{$site_url}' style='color: #E41B1C;'>{$site_url}</a></p>
                </div>
            </div>
        </body>
        </html>";
    }
    
    public function configure_smtp($phpmailer) {
        $phpmailer->isSMTP();
        $phpmailer->Host = get_option('be4hope_smtp_host', '');
        $phpmailer->SMTPAuth = true;
        $phpmailer->Port = get_option('be4hope_smtp_port', 587);
        $phpmailer->Username = get_option('be4hope_smtp_username', '');
        $phpmailer->Password = get_option('be4hope_smtp_password', '');
        $phpmailer->SMTPSecure = 'tls';
        $phpmailer->From = get_option('be4hope_email_from_address', get_option('admin_email'));
        $phpmailer->FromName = get_option('be4hope_email_from_name', get_bloginfo('name'));
    }
    
    private function create_email_template($subject, $message) {
        $company_name = get_option('be4hope_email_from_name', get_bloginfo('name'));
        $site_url = get_site_url();
        
        return "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset='UTF-8'>
            <meta name='viewport' content='width=device-width, initial-scale=1.0'>
            <title>{$subject}</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #E41B1C; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #fff; padding: 30px; border: 1px solid #ddd; }
                .footer { background: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
                .button { display: inline-block; background: #E41B1C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <h1>{$company_name}</h1>
                </div>
                <div class='content'>
                    " . nl2br(esc_html($message)) . "
                </div>
                <div class='footer'>
                    <p>Este email foi enviado automaticamente pelo sistema {$company_name}</p>
                    <p><a href='{$site_url}' style='color: #E41B1C;'>{$site_url}</a></p>
                </div>
            </div>
        </body>
        </html>";
    }
    
    // Helper methods
    private function get_patients_count() {
        global $wpdb;
        return $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}be4hope_patients WHERE status = 'active'");
    }
    
    private function get_medications_count() {
        global $wpdb;
        return $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}be4hope_medications WHERE status = 'active'");
    }
    
    private function get_critical_alerts() {
        global $wpdb;
        return $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}be4hope_medications WHERE status = 'active' AND notification_10_days <= CURDATE()");
    }
    
    private function show_recent_alerts() {
        global $wpdb;
        $alerts = $wpdb->get_results("
            SELECT m.product_name, p.name as patient_name, m.estimated_end_date
            FROM {$wpdb->prefix}be4hope_medications m
            LEFT JOIN {$wpdb->prefix}be4hope_patients p ON m.patient_id = p.id
            WHERE m.status = 'active' AND m.notification_30_days <= CURDATE()
            ORDER BY m.estimated_end_date ASC
            LIMIT 5
        ");
        
        if ($alerts) {
            echo '<ul>';
            foreach ($alerts as $alert) {
                $days_remaining = (strtotime($alert->estimated_end_date) - time()) / (60 * 60 * 24);
                echo '<li>' . esc_html($alert->patient_name) . ' - ' . esc_html($alert->product_name) . ' (' . round($days_remaining) . ' dias)</li>';
            }
            echo '</ul>';
        } else {
            echo '<p>Nenhum alerta no momento.</p>';
        }
    }
    
    public function activate() {
        $this->create_tables();
        flush_rewrite_rules();
    }
    
    private function create_tables() {
        global $wpdb;
        
        $charset_collate = $wpdb->get_charset_collate();
        
        // Patients table
        $sql_patients = "CREATE TABLE {$wpdb->prefix}be4hope_patients (
            id int(11) NOT NULL AUTO_INCREMENT,
            name varchar(255) NOT NULL,
            email varchar(255) NOT NULL,
            phone varchar(20),
            birth_date date,
            weight decimal(5,2),
            status varchar(20) DEFAULT 'active',
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) $charset_collate;";
        
        // Products table
        $sql_products = "CREATE TABLE {$wpdb->prefix}be4hope_products (
            id int(11) NOT NULL AUTO_INCREMENT,
            name varchar(255) NOT NULL,
            brand varchar(100) NOT NULL,
            volume_ml decimal(5,2) NOT NULL,
            total_drops int(11) NOT NULL,
            cbd_mg_per_drop decimal(6,3) NOT NULL,
            thc_mg_per_drop decimal(6,3) DEFAULT 0,
            cbn_mg_per_drop decimal(6,3) DEFAULT 0,
            cbg_mg_per_drop decimal(6,3) DEFAULT 0,
            thcv_mg_per_drop decimal(6,3) DEFAULT 0,
            spectrum_type varchar(20) NOT NULL,
            has_nanotechnology tinyint(1) DEFAULT 0,
            price decimal(10,2) DEFAULT NULL,
            status varchar(20) DEFAULT 'active',
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) $charset_collate;";
        
        // Medications table (updated to reference products)
        $sql_medications = "CREATE TABLE {$wpdb->prefix}be4hope_medications (
            id int(11) NOT NULL AUTO_INCREMENT,
            patient_id int(11) NOT NULL,
            product_id int(11) DEFAULT NULL,
            product_name varchar(255) NOT NULL,
            daily_drops int(11) NOT NULL,
            bottle_count int(11) DEFAULT 1,
            start_date date NOT NULL,
            estimated_end_date date,
            notification_40_days date,
            notification_30_days date,
            notification_10_days date,
            status varchar(20) DEFAULT 'active',
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY patient_id (patient_id),
            KEY product_id (product_id)
        ) $charset_collate;";
        
        // Licenses table
        $sql_licenses = "CREATE TABLE {$wpdb->prefix}be4hope_licenses (
            id int(11) NOT NULL AUTO_INCREMENT,
            patient_id int(11) NOT NULL,
            license_number varchar(255) NOT NULL,
            license_type varchar(100) NOT NULL,
            issue_date date NOT NULL,
            expiry_date date NOT NULL,
            issuing_authority varchar(255) DEFAULT 'ANVISA',
            notes text,
            status varchar(20) DEFAULT 'active',
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY patient_id (patient_id)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql_patients);
        dbDelta($sql_products);
        dbDelta($sql_medications);
        dbDelta($sql_licenses);
        
        // Insert default products
        $this->insert_default_products();
    }
    
    private function insert_default_products() {
        global $wpdb;
        
        // Check if products already exist
        $existing = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}be4hope_products");
        if ($existing > 0) {
            return; // Products already exist
        }
        
        // Default Be4Hope products
        $default_products = array(
            array(
                'name' => 'Greens MED 6300mg Full Spectrum',
                'brand' => 'Greens MED',
                'volume_ml' => 30,
                'total_drops' => 900,
                'cbd_mg_per_drop' => 6.66,
                'thc_mg_per_drop' => 0.33,
                'spectrum_type' => 'full',
                'has_nanotechnology' => 1
            ),
            array(
                'name' => 'Greens MED 9000mg Broad Spectrum',
                'brand' => 'Greens MED',
                'volume_ml' => 30,
                'total_drops' => 900,
                'cbd_mg_per_drop' => 10.0,
                'thc_mg_per_drop' => 0,
                'spectrum_type' => 'broad',
                'has_nanotechnology' => 1
            ),
            array(
                'name' => 'Greens LIFE 6000mg Isolated',
                'brand' => 'Greens LIFE',
                'volume_ml' => 30,
                'total_drops' => 900,
                'cbd_mg_per_drop' => 6.66,
                'thc_mg_per_drop' => 0,
                'spectrum_type' => 'isolated',
                'has_nanotechnology' => 0
            ),
            array(
                'name' => 'Greens LIFE 1500mg Isolated',
                'brand' => 'Greens LIFE',
                'volume_ml' => 30,
                'total_drops' => 900,
                'cbd_mg_per_drop' => 1.66,
                'thc_mg_per_drop' => 0,
                'spectrum_type' => 'isolated',
                'has_nanotechnology' => 0
            ),
            array(
                'name' => 'Greens LIFE 1500mg Broad Spectrum',
                'brand' => 'Greens LIFE',
                'volume_ml' => 30,
                'total_drops' => 900,
                'cbd_mg_per_drop' => 1.66,
                'thc_mg_per_drop' => 0,
                'spectrum_type' => 'broad',
                'has_nanotechnology' => 0
            ),
            array(
                'name' => 'Greens LIFE 1500mg Full Spectrum',
                'brand' => 'Greens LIFE',
                'volume_ml' => 30,
                'total_drops' => 900,
                'cbd_mg_per_drop' => 1.66,
                'thc_mg_per_drop' => 0.08,
                'spectrum_type' => 'full',
                'has_nanotechnology' => 0
            )
        );
        
        foreach ($default_products as $product) {
            $product['created_at'] = current_time('mysql');
            $wpdb->insert($wpdb->prefix . 'be4hope_products', $product);
        }
    }
}

// Initialize the plugin
new Be4HopeMedicationTracker();
?>
