<?php
// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class Be4Hope_Admin_Alerts {
    
    public function __construct() {
        // Schedule daily check for alerts
        add_action('wp', array($this, 'schedule_daily_alerts'));
        add_action('be4hope_daily_alert_check', array($this, 'check_and_send_alerts'));
        
        // Manual alert check (for testing)
        add_action('wp_ajax_be4hope_check_alerts_now', array($this, 'ajax_check_alerts_now'));
    }
    
    public function schedule_daily_alerts() {
        if (!wp_next_scheduled('be4hope_daily_alert_check')) {
            wp_schedule_event(time(), 'daily', 'be4hope_daily_alert_check');
        }
    }
    
    public function check_and_send_alerts() {
        global $wpdb;
        
        $admin_email = get_option('be4hope_admin_email', get_option('admin_email'));
        $alerts_sent = array();
        
        // Check medications ending soon
        $medications_alerts = $this->check_medication_alerts();
        if (!empty($medications_alerts)) {
            $this->send_medication_alerts_to_admin($medications_alerts, $admin_email);
            $alerts_sent['medications'] = count($medications_alerts);
        }
        
        // Check licenses expiring soon
        $license_alerts = $this->check_license_alerts();
        if (!empty($license_alerts)) {
            $this->send_license_alerts_to_admin($license_alerts, $admin_email);
            $alerts_sent['licenses'] = count($license_alerts);
        }
        
        // Check overdue billings
        $billing_alerts = $this->check_billing_alerts();
        if (!empty($billing_alerts)) {
            $this->send_billing_alerts_to_admin($billing_alerts, $admin_email);
            $alerts_sent['billings'] = count($billing_alerts);
        }
        
        // Log alerts sent
        if (!empty($alerts_sent)) {
            update_option('be4hope_last_alerts_sent', array(
                'date' => current_time('mysql'),
                'alerts' => $alerts_sent
            ));
        }
        
        return $alerts_sent;
    }
    
    private function check_medication_alerts() {
        global $wpdb;
        
        $alerts = array();
        $today = date('Y-m-d');
        
        // Get medications ending in 40, 30, or 10 days
        $medications = $wpdb->get_results($wpdb->prepare("
            SELECT m.*, p.name as patient_name, p.email as patient_email, p.phone as patient_phone
            FROM {$wpdb->prefix}be4hope_medications m
            LEFT JOIN {$wpdb->prefix}be4hope_patients p ON m.patient_id = p.id
            WHERE m.status = 'active' 
            AND (
                m.notification_40_days = %s OR 
                m.notification_30_days = %s OR 
                m.notification_10_days = %s
            )
            ORDER BY m.estimated_end_date ASC
        ", $today, $today, $today));
        
        foreach ($medications as $med) {
            $days_remaining = (strtotime($med->estimated_end_date) - time()) / (60 * 60 * 24);
            $days_remaining = round($days_remaining);
            
            $priority = 'medium';
            if ($days_remaining <= 10) {
                $priority = 'critical';
            } elseif ($days_remaining <= 30) {
                $priority = 'high';
            }
            
            $alerts[] = array(
                'type' => 'medication',
                'priority' => $priority,
                'patient_name' => $med->patient_name,
                'patient_email' => $med->patient_email,
                'patient_phone' => $med->patient_phone,
                'product_name' => $med->product_name,
                'days_remaining' => $days_remaining,
                'end_date' => $med->estimated_end_date,
                'medication_id' => $med->id
            );
        }
        
        return $alerts;
    }
    
    private function check_license_alerts() {
        global $wpdb;
        
        $alerts = array();
        
        // Check if licenses table exists (will be created in future version)
        $table_exists = $wpdb->get_var("SHOW TABLES LIKE '{$wpdb->prefix}be4hope_licenses'");
        if (!$table_exists) {
            return $alerts;
        }
        
        $today = date('Y-m-d');
        $alert_date = date('Y-m-d', strtotime('+60 days')); // 60 days before expiry
        
        $licenses = $wpdb->get_results($wpdb->prepare("
            SELECT l.*, p.name as patient_name, p.email as patient_email
            FROM {$wpdb->prefix}be4hope_licenses l
            LEFT JOIN {$wpdb->prefix}be4hope_patients p ON l.patient_id = p.id
            WHERE l.status = 'active' 
            AND l.expiry_date <= %s
            AND l.expiry_date >= %s
            ORDER BY l.expiry_date ASC
        ", $alert_date, $today));
        
        foreach ($licenses as $license) {
            $days_remaining = (strtotime($license->expiry_date) - time()) / (60 * 60 * 24);
            
            $alerts[] = array(
                'type' => 'license',
                'priority' => $days_remaining <= 30 ? 'critical' : 'high',
                'patient_name' => $license->patient_name,
                'patient_email' => $license->patient_email,
                'license_number' => $license->license_number,
                'days_remaining' => round($days_remaining),
                'expiry_date' => $license->expiry_date,
                'license_id' => $license->id
            );
        }
        
        return $alerts;
    }
    
    private function check_billing_alerts() {
        global $wpdb;
        
        $alerts = array();
        
        // Check if billings table exists (will be created in future version)
        $table_exists = $wpdb->get_var("SHOW TABLES LIKE '{$wpdb->prefix}be4hope_billings'");
        if (!$table_exists) {
            return $alerts;
        }
        
        $today = date('Y-m-d');
        
        $overdue_billings = $wpdb->get_results($wpdb->prepare("
            SELECT b.*, p.name as patient_name, p.email as patient_email
            FROM {$wpdb->prefix}be4hope_billings b
            LEFT JOIN {$wpdb->prefix}be4hope_patients p ON b.patient_id = p.id
            WHERE b.status = 'pending' 
            AND b.due_date < %s
            ORDER BY b.due_date ASC
        ", $today));
        
        foreach ($overdue_billings as $billing) {
            $days_overdue = (time() - strtotime($billing->due_date)) / (60 * 60 * 24);
            
            $alerts[] = array(
                'type' => 'billing',
                'priority' => $days_overdue > 30 ? 'critical' : 'high',
                'patient_name' => $billing->patient_name,
                'patient_email' => $billing->patient_email,
                'amount' => $billing->amount,
                'due_date' => $billing->due_date,
                'days_overdue' => round($days_overdue),
                'billing_id' => $billing->id
            );
        }
        
        return $alerts;
    }
    
    private function send_medication_alerts_to_admin($alerts, $admin_email) {
        $critical_alerts = array_filter($alerts, function($alert) {
            return $alert['priority'] === 'critical';
        });
        
        $high_alerts = array_filter($alerts, function($alert) {
            return $alert['priority'] === 'high';
        });
        
        $medium_alerts = array_filter($alerts, function($alert) {
            return $alert['priority'] === 'medium';
        });
        
        $subject = '🚨 ALERTA BE4HOPE - Medicações Terminando';
        if (!empty($critical_alerts)) {
            $subject = '🔴 ALERTA CRÍTICO BE4HOPE - Medicações Terminando em Breve';
        }
        
        $message = $this->create_medication_alert_email($critical_alerts, $high_alerts, $medium_alerts);
        
        $this->send_admin_email($admin_email, $subject, $message);
    }
    
    private function send_license_alerts_to_admin($alerts, $admin_email) {
        $subject = '📋 ALERTA BE4HOPE - Licenças ANVISA Vencendo';
        $message = $this->create_license_alert_email($alerts);
        
        $this->send_admin_email($admin_email, $subject, $message);
    }
    
    private function send_billing_alerts_to_admin($alerts, $admin_email) {
        $subject = '💰 ALERTA BE4HOPE - Mensalidades em Atraso';
        $message = $this->create_billing_alert_email($alerts);
        
        $this->send_admin_email($admin_email, $subject, $message);
    }
    
    private function create_medication_alert_email($critical, $high, $medium) {
        $content = '<h2 style="color: #E41B1C; margin-bottom: 20px;">🚨 ALERTAS DE MEDICAÇÃO</h2>';
        
        if (!empty($critical)) {
            $content .= '<div style="background: #fee2e2; border-left: 4px solid #E41B1C; padding: 15px; margin: 15px 0; border-radius: 4px;">';
            $content .= '<h3 style="color: #E41B1C; margin: 0 0 10px 0;">🔴 CRÍTICO - Terminam em até 10 dias</h3>';
            foreach ($critical as $alert) {
                $content .= '<div style="margin: 10px 0; padding: 10px; background: white; border-radius: 4px;">';
                $content .= '<strong>' . esc_html($alert['patient_name']) . '</strong><br>';
                $content .= 'Produto: ' . esc_html($alert['product_name']) . '<br>';
                $content .= 'Termina em: <strong style="color: #E41B1C;">' . $alert['days_remaining'] . ' dias</strong> (' . date('d/m/Y', strtotime($alert['end_date'])) . ')<br>';
                if ($alert['patient_phone']) {
                    $content .= 'Telefone: ' . esc_html($alert['patient_phone']) . '<br>';
                }
                $content .= '</div>';
            }
            $content .= '</div>';
        }
        
        if (!empty($high)) {
            $content .= '<div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; border-radius: 4px;">';
            $content .= '<h3 style="color: #f59e0b; margin: 0 0 10px 0;">🟡 ATENÇÃO - Terminam em até 30 dias</h3>';
            foreach ($high as $alert) {
                $content .= '<div style="margin: 10px 0; padding: 10px; background: white; border-radius: 4px;">';
                $content .= '<strong>' . esc_html($alert['patient_name']) . '</strong><br>';
                $content .= 'Produto: ' . esc_html($alert['product_name']) . '<br>';
                $content .= 'Termina em: ' . $alert['days_remaining'] . ' dias (' . date('d/m/Y', strtotime($alert['end_date'])) . ')<br>';
                if ($alert['patient_phone']) {
                    $content .= 'Telefone: ' . esc_html($alert['patient_phone']) . '<br>';
                }
                $content .= '</div>';
            }
            $content .= '</div>';
        }
        
        if (!empty($medium)) {
            $content .= '<div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 15px 0; border-radius: 4px;">';
            $content .= '<h3 style="color: #3b82f6; margin: 0 0 10px 0;">🔵 AVISO - Terminam em 40 dias</h3>';
            foreach ($medium as $alert) {
                $content .= '<div style="margin: 10px 0; padding: 10px; background: white; border-radius: 4px;">';
                $content .= '<strong>' . esc_html($alert['patient_name']) . '</strong><br>';
                $content .= 'Produto: ' . esc_html($alert['product_name']) . '<br>';
                $content .= 'Termina em: ' . $alert['days_remaining'] . ' dias (' . date('d/m/Y', strtotime($alert['end_date'])) . ')<br>';
                if ($alert['patient_phone']) {
                    $content .= 'Telefone: ' . esc_html($alert['patient_phone']) . '<br>';
                }
                $content .= '</div>';
            }
            $content .= '</div>';
        }
        
        $content .= '<div style="margin-top: 30px; padding: 15px; background: #f9f9f9; border-radius: 4px;">';
        $content .= '<h4 style="color: #E41B1C; margin: 0 0 10px 0;">📋 AÇÕES NECESSÁRIAS:</h4>';
        $content .= '<ul style="margin: 0; padding-left: 20px;">';
        $content .= '<li>Entrar em contato com os pacientes para confirmar necessidade de recompra</li>';
        $content .= '<li>Providenciar pedidos de importação com antecedência</li>';
        $content .= '<li>Verificar documentação necessária para cada paciente</li>';
        $content .= '<li>Acompanhar prazos de entrega dos fornecedores</li>';
        $content .= '</ul>';
        $content .= '</div>';
        
        return $content;
    }
    
    private function create_license_alert_email($alerts) {
        $content = '<h2 style="color: #E41B1C; margin-bottom: 20px;">📋 ALERTAS DE LICENÇAS ANVISA</h2>';
        
        foreach ($alerts as $alert) {
            $priority_color = $alert['priority'] === 'critical' ? '#E41B1C' : '#f59e0b';
            $priority_text = $alert['priority'] === 'critical' ? 'CRÍTICO' : 'ATENÇÃO';
            
            $content .= '<div style="background: #fee2e2; border-left: 4px solid ' . $priority_color . '; padding: 15px; margin: 15px 0; border-radius: 4px;">';
            $content .= '<h3 style="color: ' . $priority_color . '; margin: 0 0 10px 0;">' . $priority_text . '</h3>';
            $content .= '<strong>' . esc_html($alert['patient_name']) . '</strong><br>';
            $content .= 'Licença: ' . esc_html($alert['license_number']) . '<br>';
            $content .= 'Vence em: <strong style="color: #E41B1C;">' . $alert['days_remaining'] . ' dias</strong> (' . date('d/m/Y', strtotime($alert['expiry_date'])) . ')<br>';
            $content .= '</div>';
        }
        
        return $content;
    }
    
    private function create_billing_alert_email($alerts) {
        $content = '<h2 style="color: #E41B1C; margin-bottom: 20px;">💰 ALERTAS DE MENSALIDADES</h2>';
        
        foreach ($alerts as $alert) {
            $content .= '<div style="background: #fee2e2; border-left: 4px solid #E41B1C; padding: 15px; margin: 15px 0; border-radius: 4px;">';
            $content .= '<strong>' . esc_html($alert['patient_name']) . '</strong><br>';
            $content .= 'Valor: R$ ' . number_format($alert['amount'], 2, ',', '.') . '<br>';
            $content .= 'Vencimento: ' . date('d/m/Y', strtotime($alert['due_date'])) . '<br>';
            $content .= 'Atraso: <strong style="color: #E41B1C;">' . $alert['days_overdue'] . ' dias</strong><br>';
            $content .= '</div>';
        }
        
        return $content;
    }
    
    private function send_admin_email($to, $subject, $content) {
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
    
    // AJAX handler for manual alert check
    public function ajax_check_alerts_now() {
        check_ajax_referer('be4hope_nonce', 'nonce');
        
        $alerts_sent = $this->check_and_send_alerts();
        
        if (!empty($alerts_sent)) {
            $message = 'Alertas enviados: ';
            $parts = array();
            if (isset($alerts_sent['medications'])) {
                $parts[] = $alerts_sent['medications'] . ' medicações';
            }
            if (isset($alerts_sent['licenses'])) {
                $parts[] = $alerts_sent['licenses'] . ' licenças';
            }
            if (isset($alerts_sent['billings'])) {
                $parts[] = $alerts_sent['billings'] . ' mensalidades';
            }
            $message .= implode(', ', $parts);
            
            wp_send_json_success($message);
        } else {
            wp_send_json_success('Nenhum alerta necessário no momento.');
        }
    }
}

// Initialize the admin alerts system
new Be4Hope_Admin_Alerts();
?>
