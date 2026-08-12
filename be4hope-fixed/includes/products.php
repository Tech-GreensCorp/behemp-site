<?php
// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Handle form submissions
if (isset($_POST['save_product'])) {
    global $wpdb;
    
    $data = array(
        'name' => sanitize_text_field($_POST['product_name']),
        'brand' => sanitize_text_field($_POST['brand']),
        'volume_ml' => floatval($_POST['volume_ml']),
        'total_drops' => intval($_POST['total_drops']),
        'cbd_mg_per_drop' => floatval($_POST['cbd_mg_per_drop']),
        'thc_mg_per_drop' => floatval($_POST['thc_mg_per_drop']),
        'cbn_mg_per_drop' => floatval($_POST['cbn_mg_per_drop']),
        'cbg_mg_per_drop' => floatval($_POST['cbg_mg_per_drop']),
        'thcv_mg_per_drop' => floatval($_POST['thcv_mg_per_drop']),
        'spectrum_type' => sanitize_text_field($_POST['spectrum_type']),
        'has_nanotechnology' => isset($_POST['has_nanotechnology']) ? 1 : 0,
        'price' => floatval($_POST['price']),
        'status' => 'active'
    );
    
    if (isset($_POST['product_id']) && !empty($_POST['product_id'])) {
        // Update
        $result = $wpdb->update(
            $wpdb->prefix . 'be4hope_products',
            $data,
            array('id' => intval($_POST['product_id']))
        );
        $message = 'Produto atualizado com sucesso!';
    } else {
        // Insert
        $data['created_at'] = current_time('mysql');
        $result = $wpdb->insert($wpdb->prefix . 'be4hope_products', $data);
        $message = 'Produto cadastrado com sucesso!';
    }
    
    if ($result !== false) {
        echo '<div class="notice notice-success"><p>' . $message . '</p></div>';
    } else {
        echo '<div class="notice notice-error"><p>Erro ao salvar produto.</p></div>';
    }
}

// Handle product deletion
if (isset($_GET['action']) && $_GET['action'] === 'delete' && isset($_GET['id'])) {
    global $wpdb;
    $wpdb->update(
        $wpdb->prefix . 'be4hope_products',
        array('status' => 'inactive'),
        array('id' => intval($_GET['id']))
    );
    echo '<div class="notice notice-success"><p>Produto removido com sucesso!</p></div>';
}

$action = isset($_GET['action']) ? $_GET['action'] : 'list';

if ($action === 'list') {
    show_products_list();
} elseif ($action === 'add' || $action === 'edit') {
    show_product_form($action);
}

function show_products_list() {
    global $wpdb;
    $products = $wpdb->get_results("SELECT * FROM {$wpdb->prefix}be4hope_products WHERE status = 'active' ORDER BY brand, name");
    ?>
    <div class="wrap">
        <h1>
            Produtos Be4Hope
            <a href="<?php echo admin_url('admin.php?page=be4hope-products&action=add'); ?>" class="page-title-action">Adicionar Novo</a>
        </h1>
        
        <div style="background: #e7f3ff; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #E41B1C;">📦 Gestão de Produtos</h3>
            <p style="margin: 0;">Cadastre todos os produtos com suas especificações técnicas para cálculos precisos de duração e alertas automáticos.</p>
        </div>
        
        <?php if (empty($products)): ?>
            <div style="text-align: center; padding: 50px; background: #fff; border: 1px solid #c3c4c7; border-radius: 4px;">
                <h3>Nenhum produto cadastrado</h3>
                <p>Comece cadastrando os produtos Be4Hope para ter controle preciso das medicações.</p>
                <a href="<?php echo admin_url('admin.php?page=be4hope-products&action=add'); ?>" class="button button-primary">Cadastrar Primeiro Produto</a>
            </div>
        <?php else: ?>
            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th style="width: 25%;">Produto</th>
                        <th style="width: 15%;">Volume</th>
                        <th style="width: 15%;">Total Gotas</th>
                        <th style="width: 20%;">Concentração CBD</th>
                        <th style="width: 10%;">Espectro</th>
                        <th style="width: 15%;">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($products as $product): ?>
                    <tr>
                        <td>
                            <strong><?php echo esc_html($product->name); ?></strong><br>
                            <small style="color: #666;"><?php echo esc_html($product->brand); ?></small>
                            <?php if ($product->has_nanotechnology): ?>
                                <span style="background: #E41B1C; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-left: 5px;">NANO</span>
                            <?php endif; ?>
                        </td>
                        <td><?php echo $product->volume_ml; ?> mL</td>
                        <td><?php echo number_format($product->total_drops, 0, ',', '.'); ?> gotas</td>
                        <td>
                            <?php echo $product->cbd_mg_per_drop; ?> mg CBD/gota
                            <?php if ($product->thc_mg_per_drop > 0): ?>
                                <br><small><?php echo $product->thc_mg_per_drop; ?> mg THC/gota</small>
                            <?php endif; ?>
                        </td>
                        <td>
                            <?php 
                            $spectrum_labels = array(
                                'isolated' => 'Isolado',
                                'broad' => 'Broad',
                                'full' => 'Full'
                            );
                            echo $spectrum_labels[$product->spectrum_type] ?? $product->spectrum_type;
                            ?>
                        </td>
                        <td>
                            <a href="<?php echo admin_url('admin.php?page=be4hope-products&action=edit&id=' . $product->id); ?>" class="button button-small">Editar</a>
                            <a href="<?php echo admin_url('admin.php?page=be4hope-products&action=delete&id=' . $product->id); ?>" 
                               class="button button-small" 
                               onclick="return confirm('Tem certeza que deseja remover este produto?')">Remover</a>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>
        
        <div style="margin-top: 30px; padding: 20px; background: #fff; border: 1px solid #c3c4c7; border-radius: 4px;">
            <h3 style="color: #E41B1C; margin: 0 0 15px 0;">📊 Estatísticas dos Produtos</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div style="text-align: center; padding: 15px; background: #f9f9f9; border-radius: 4px;">
                    <strong style="font-size: 24px; color: #E41B1C;"><?php echo count($products); ?></strong>
                    <p style="margin: 5px 0 0 0;">Produtos Ativos</p>
                </div>
                <div style="text-align: center; padding: 15px; background: #f9f9f9; border-radius: 4px;">
                    <strong style="font-size: 24px; color: #E41B1C;">
                        <?php echo count(array_filter($products, function($p) { return $p->has_nanotechnology; })); ?>
                    </strong>
                    <p style="margin: 5px 0 0 0;">Com Nanotecnologia</p>
                </div>
                <div style="text-align: center; padding: 15px; background: #f9f9f9; border-radius: 4px;">
                    <strong style="font-size: 24px; color: #E41B1C;">
                        <?php 
                        $brands = array_unique(array_column($products, 'brand'));
                        echo count($brands);
                        ?>
                    </strong>
                    <p style="margin: 5px 0 0 0;">Marcas</p>
                </div>
            </div>
        </div>
    </div>
    <?php
}

function show_product_form($action) {
    global $wpdb;
    $product = null;
    
    if ($action === 'edit' && isset($_GET['id'])) {
        $product = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}be4hope_products WHERE id = %d", intval($_GET['id'])));
    }
    ?>
    <div class="wrap">
        <h1><?php echo $action === 'add' ? 'Adicionar Produto' : 'Editar Produto'; ?></h1>
        
        <form method="post" action="">
            <?php wp_nonce_field('be4hope_product', 'nonce'); ?>
            <?php if ($action === 'edit'): ?>
                <input type="hidden" name="product_id" value="<?php echo $product->id; ?>">
            <?php endif; ?>
            
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 30px; max-width: 1200px;">
                
                <!-- Main Product Info -->
                <div class="postbox">
                    <div class="postbox-header">
                        <h2 class="hndle">Informações do Produto</h2>
                    </div>
                    <div class="inside">
                        <table class="form-table">
                            <tr>
                                <th scope="row"><label for="product_name">Nome do Produto *</label></th>
                                <td>
                                    <input type="text" id="product_name" name="product_name" required class="regular-text" 
                                           value="<?php echo $product ? esc_attr($product->name) : ''; ?>" 
                                           placeholder="Ex: Greens MED 6300mg Full Spectrum">
                                </td>
                            </tr>
                            <tr>
                                <th scope="row"><label for="brand">Marca *</label></th>
                                <td>
                                    <select id="brand" name="brand" required class="regular-text">
                                        <option value="">Selecione a marca</option>
                                        <option value="Greens MED" <?php echo ($product && $product->brand === 'Greens MED') ? 'selected' : ''; ?>>Greens MED</option>
                                        <option value="Greens LIFE" <?php echo ($product && $product->brand === 'Greens LIFE') ? 'selected' : ''; ?>>Greens LIFE</option>
                                        <option value="Greens BALANCE" <?php echo ($product && $product->brand === 'Greens BALANCE') ? 'selected' : ''; ?>>Greens BALANCE</option>
                                        <option value="Outros" <?php echo ($product && $product->brand === 'Outros') ? 'selected' : ''; ?>>Outros</option>
                                    </select>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row"><label for="spectrum_type">Tipo de Espectro *</label></th>
                                <td>
                                    <select id="spectrum_type" name="spectrum_type" required class="regular-text">
                                        <option value="">Selecione o espectro</option>
                                        <option value="isolated" <?php echo ($product && $product->spectrum_type === 'isolated') ? 'selected' : ''; ?>>Isolado (CBD apenas)</option>
                                        <option value="broad" <?php echo ($product && $product->spectrum_type === 'broad') ? 'selected' : ''; ?>>Broad Spectrum (sem THC)</option>
                                        <option value="full" <?php echo ($product && $product->spectrum_type === 'full') ? 'selected' : ''; ?>>Full Spectrum (com THC)</option>
                                    </select>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">Nanotecnologia</th>
                                <td>
                                    <label>
                                        <input type="checkbox" name="has_nanotechnology" value="1" 
                                               <?php echo ($product && $product->has_nanotechnology) ? 'checked' : ''; ?>>
                                        Este produto possui nanotecnologia
                                    </label>
                                    <p class="description">Produtos com nanotecnologia têm absorção mais rápida</p>
                                </td>
                            </tr>
                        </table>
                    </div>
                </div>
                
                <!-- Technical Specifications -->
                <div class="postbox">
                    <div class="postbox-header">
                        <h2 class="hndle">Especificações Técnicas</h2>
                    </div>
                    <div class="inside">
                        <table class="form-table">
                            <tr>
                                <th scope="row"><label for="volume_ml">Volume (mL) *</label></th>
                                <td>
                                    <input type="number" id="volume_ml" name="volume_ml" required class="small-text" 
                                           step="0.1" min="0.1" max="100"
                                           value="<?php echo $product ? esc_attr($product->volume_ml) : '30'; ?>">
                                    <p class="description">Volume total do frasco</p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row"><label for="total_drops">Total de Gotas *</label></th>
                                <td>
                                    <input type="number" id="total_drops" name="total_drops" required class="small-text" 
                                           min="1" max="5000"
                                           value="<?php echo $product ? esc_attr($product->total_drops) : '900'; ?>">
                                    <p class="description">Número total de gotas no frasco</p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row"><label for="price">Preço (R$)</label></th>
                                <td>
                                    <input type="number" id="price" name="price" class="small-text" 
                                           step="0.01" min="0"
                                           value="<?php echo $product ? esc_attr($product->price) : ''; ?>">
                                    <p class="description">Preço de venda (opcional)</p>
                                </td>
                            </tr>
                        </table>
                    </div>
                </div>
                
            </div>
            
            <!-- Cannabinoid Concentrations -->
            <div class="postbox" style="max-width: 1200px; margin-top: 20px;">
                <div class="postbox-header">
                    <h2 class="hndle">Concentrações de Canabinoides (mg por gota)</h2>
                </div>
                <div class="inside">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                        <div>
                            <label for="cbd_mg_per_drop"><strong>CBD (mg/gota) *</strong></label>
                            <input type="number" id="cbd_mg_per_drop" name="cbd_mg_per_drop" required 
                                   class="regular-text" step="0.01" min="0" max="50"
                                   value="<?php echo $product ? esc_attr($product->cbd_mg_per_drop) : ''; ?>"
                                   placeholder="Ex: 6.66">
                            <p class="description">Concentração de CBD por gota</p>
                        </div>
                        
                        <div>
                            <label for="thc_mg_per_drop"><strong>THC (mg/gota)</strong></label>
                            <input type="number" id="thc_mg_per_drop" name="thc_mg_per_drop" 
                                   class="regular-text" step="0.01" min="0" max="50"
                                   value="<?php echo $product ? esc_attr($product->thc_mg_per_drop) : '0'; ?>"
                                   placeholder="Ex: 0.33">
                            <p class="description">Concentração de THC por gota</p>
                        </div>
                        
                        <div>
                            <label for="cbn_mg_per_drop"><strong>CBN (mg/gota)</strong></label>
                            <input type="number" id="cbn_mg_per_drop" name="cbn_mg_per_drop" 
                                   class="regular-text" step="0.01" min="0" max="50"
                                   value="<?php echo $product ? esc_attr($product->cbn_mg_per_drop) : '0'; ?>"
                                   placeholder="Ex: 1.0">
                            <p class="description">Concentração de CBN por gota</p>
                        </div>
                        
                        <div>
                            <label for="cbg_mg_per_drop"><strong>CBG (mg/gota)</strong></label>
                            <input type="number" id="cbg_mg_per_drop" name="cbg_mg_per_drop" 
                                   class="regular-text" step="0.01" min="0" max="50"
                                   value="<?php echo $product ? esc_attr($product->cbg_mg_per_drop) : '0'; ?>"
                                   placeholder="Ex: 2.0">
                            <p class="description">Concentração de CBG por gota</p>
                        </div>
                        
                        <div>
                            <label for="thcv_mg_per_drop"><strong>THCV (mg/gota)</strong></label>
                            <input type="number" id="thcv_mg_per_drop" name="thcv_mg_per_drop" 
                                   class="regular-text" step="0.01" min="0" max="50"
                                   value="<?php echo $product ? esc_attr($product->thcv_mg_per_drop) : '0'; ?>"
                                   placeholder="Ex: 0.5">
                            <p class="description">Concentração de THCV por gota</p>
                        </div>
                    </div>
                    
                    <div style="margin-top: 20px; padding: 15px; background: #e7f3ff; border-radius: 4px;">
                        <h4 style="margin: 0 0 10px 0; color: #E41B1C;">💡 Cálculo Automático</h4>
                        <p style="margin: 0;">Com essas informações, o sistema calculará automaticamente:</p>
                        <ul style="margin: 10px 0 0 20px;">
                            <li>Duração precisa da medicação baseada na dosagem diária</li>
                            <li>Alertas automáticos nos momentos corretos</li>
                            <li>Previsão de recompra com antecedência adequada</li>
                            <li>Estatísticas de consumo por paciente</li>
                        </ul>
                    </div>
                </div>
            </div>
            
            <p class="submit">
                <button type="submit" name="save_product" class="button button-primary">
                    <?php echo $action === 'add' ? 'Cadastrar Produto' : 'Atualizar Produto'; ?>
                </button>
                <a href="<?php echo admin_url('admin.php?page=be4hope-products'); ?>" class="button">Cancelar</a>
            </p>
        </form>
    </div>
    
    <script>
    jQuery(document).ready(function($) {
        // Auto-calculate drops from volume
        $('#volume_ml').on('input', function() {
            const volume = parseFloat($(this).val()) || 0;
            const estimatedDrops = Math.round(volume * 30); // Aproximadamente 30 gotas por mL
            if (volume > 0 && $('#total_drops').val() === '') {
                $('#total_drops').val(estimatedDrops);
            }
        });
        
        // Show concentration info based on brand
        $('#brand').on('change', function() {
            const brand = $(this).val();
            const suggestions = {
                'Greens MED': {
                    'cbd': '6.66 ou 10.0',
                    'thc': '0.33 (para Full Spectrum)'
                },
                'Greens LIFE': {
                    'cbd': '1.66 ou 6.66',
                    'thc': '0 (Isolated/Broad)'
                },
                'Greens BALANCE': {
                    'cbd': 'Varia por produto',
                    'thc': 'Varia por produto'
                }
            };
            
            if (suggestions[brand]) {
                // Could show suggestions here
            }
        });
        
        // Validate cannabinoid concentrations
        $('input[name$="_mg_per_drop"]').on('blur', function() {
            const value = parseFloat($(this).val()) || 0;
            if (value > 50) {
                alert('Atenção: Concentração muito alta. Verifique se está correto.');
            }
        });
    });
    </script>
    <?php
}
?>
