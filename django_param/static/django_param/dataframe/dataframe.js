                                                   /*****************************************************************************
 * FILE:    spatial_dataset_mwv.js
 * DATE:    March 7, 2019
 * AUTHOR:  Nathan Swain
 * COPYRIGHT: (c) Aquaveo 2019
 * LICENSE:
 *****************************************************************************/

/************************************************************************
*                      MODULE LEVEL / GLOBAL VARIABLES
*************************************************************************/
// Constants
var TABLE_SELECTOR = '#spatial-dataset-table';
var TABLE_FIELD_SELECTOR = TABLE_SELECTOR + ' input';
var PLOT_ID = 'spatial-dataset-plot'
var PLOT_SELECTOR = '#' + PLOT_ID;

// Module variables
var m_max_rows;                     // Maximum number of rows allowed

// Plot variables
var m_plot_columns,                 // Columns to plot (if any)
    m_plotting_enabled,             // Stores whether plotting is enabled or not
    m_plot,                         // Plot handle
    m_plot_config,                  // Configuration options for plot
    m_x_column,                     // Name of the x column
    m_y_column,                     // Name of the y column
    m_x_column_selector,            // CSS selector of the inputs for the x column
    m_y_column_selector;            // CSS selector of the inputs for the y column

var m_public_interface;				// Object returned by the module

/************************************************************************
*                    PRIVATE FUNCTION DECLARATIONS
*************************************************************************/
var after_form_load, parse_data, init_table_buttons, init_paste;

var get_num_table_rows;

var init_plot, update_plot, fit_plot, enable_automatic_plot_update, disable_automatic_plot_update;

/************************************************************************
*                    PRIVATE FUNCTION IMPLEMENTATIONS
*************************************************************************/

parse_data = function() {
    m_max_rows = $(TABLE_SELECTOR).data('max-rows');
    m_plot_columns = $(TABLE_SELECTOR).data('plot-columns');
};

get_num_table_rows = function() {
    var table_rows_selector = TABLE_SELECTOR + ' tbody tr';
    return $(table_rows_selector).length;
};

init_table_buttons = function() {
    var table_body = '#spatial-dataset-table tbody',
        last_row = table_body + ' tr:last';

    // Add Row Button
    $('#spatial-dataset-add-row-btn').on('click', function(){
        var num_rows = get_num_table_rows();

        // Add rows only up to the maximum number of rows
        var c_last_row = $(last_row).clone({withDataAndEvents: true});
        // Clear values of inputs
        $(c_last_row).find('input').each(function(index, elem) {
            $(elem).val('');
        });
        c_last_row.appendTo(table_body);
        update_plot();
    });

    // Remove Row Button
    $('#spatial-dataset-remove-row-btn').on('click', function(){
        var num_rows = get_num_table_rows();

        // Don't remove the last row
        if (num_rows > 1) {
            $(last_row).remove();
            update_plot();
        }
    });

    // Clear Table Button
    $('#spatial-dataset-clear-table-btn').on('click', function(){
        $(TABLE_FIELD_SELECTOR).each(function(index, elem) {
            $(elem).val('');
        });
        update_plot();
    });

    // Copy Table Button
    $('#spatial-dataset-copy-table-btn').on('click', function(){
        var data = {},
            columns = [],
            rows,
            s_rows = [],
            s_data;

        $(TABLE_FIELD_SELECTOR).each(function(index, elem) {
            var column = $(elem).attr('name');

            // Preserve columns order
            if (!columns.includes(column)) {
                columns.push(column);
            }

            // Lazy load column
            if (!data.hasOwnProperty(column)) {
                data[column] = [];
            }

            data[column].push($(elem).val());
        });


        if (columns.length < 1) {
            return;
        }

        // Zip data together into arrays of rows
        rows = data[columns[0]].map(function(e, i) {
            var d = [e];
            for (var j = 1; j < columns.length; j++) {
                d.push(data[columns[j]][i]);
            }
            return d;
        });

        // Serialize data for excel format
        s_rows = [];
        $.each(rows, function(index, item) {
            s_rows.push(item.join('\t'));
        });

        s_data = s_rows.join('\n');

        // Copy to clipboard
        copy_text_to_clipboard(s_data);
    });
};

init_paste = function() {
    $(TABLE_FIELD_SELECTOR).on('paste', function(e) {
        var $paste_cell = $(this),
            paste_table_id = $paste_cell.closest('table').attr('id'),
            paste_table_body = '#' + paste_table_id + ' tbody',
            all_rows = paste_table_body + ' tr',
            last_row = paste_table_body + ' tr:last';

        $.each(e.originalEvent.clipboardData.items, function(i, clipboard_item) {
            if (clipboard_item.type === 'text/plain') {
                clipboard_item.getAsString(function(text) {
                    // Initialize
                    var paste_cell_i = $paste_cell.closest('td').index(),
                        paste_cell_j = $paste_cell.closest('tr').index(),
                        num_table_rows = $(all_rows).length,
                        line_delimiter = ((text.indexOf('\r\n') === -1) ? '\n' : '\r\n'),
                        t_text = text.trim(line_delimiter),
                        data_rows = t_text.split(line_delimiter);

                    // Temporarily disable the updating of the plot
                    disable_automatic_plot_update();

                    // Parse each row of data into cells
                    // -------------------------------
                    // | +i ===> |  (1,0)  |  (2,0)  |
                    // | ________|_________|_________|
                    // | +j ||   |  (1,1)  |  (2,1)  |
                    // | ___\/___|_________|_________|
                    // Notes: (i, j), i = col, j = row
                    $.each(data_rows, function(data_j, data_row) {
                        var column_delimiter = '\t',
                            data_values = data_row.split(column_delimiter);

                        // Parse each value into the appropriate cell,
                        // relative to its position in the data array
                        $.each(data_values, function(data_i, data_value) {
                            var row_j = paste_cell_j + data_j,
                                col_i = paste_cell_i + data_i,
                                input_at_row_col = 'tr:eq('+row_j+') td:eq('+col_i+') input';

                            // Change value of the input in the appropriate cell of the table
                            var $input = $paste_cell.closest('table tbody')
                                .find(input_at_row_col);

                            // If there are no remaining inputs to insert the data into, add a new row
                            if ($input.length === 0) {
                                var num_rows = get_num_table_rows();

                                // Stop pasting loop if maximum number of rows has been reached
                                if (num_rows == m_max_rows) {
                                    return false;
                                }

                                // Clone the last row and append it to the table to add the new row
                                $(last_row).clone({withDataAndEvents: true}).appendTo(paste_table_body);
                            }

                            // Find the next input and paste the value
                            $paste_cell.closest('table tbody')
                                .find(input_at_row_col)
                                .val(data_value);
                        });
                    });

                    // Update the plot
                    update_plot();

                    // Re-enable updating of plot
                    enable_automatic_plot_update();
                    return false;
                });
            };
        });
    });
};

// Plot Methods
init_plot = function() {
    // Skip if no plot columns specified
    if (!m_plot_columns || !(m_plot_columns instanceof Array) ||
        m_plot_columns.length < 2) {

        // Mark plotting as disabled and exit init_plot
        m_plotting_enabled = false;
        return;
    }


    // Init module vars
    m_plotting_enabled = true;
    m_plot = PLOT_ID;
    m_plot_config = {
        staticPlot: true,
    };
    m_x_column = m_plot_columns[0];
    m_y_column = m_plot_columns[1];
    m_x_column_selector = "input[name='" + m_x_column + "']";
    m_y_column_selector = "input[name='" + m_y_column + "']";

    // Create empty plot
    update_plot();

    // Bind update input update events
    enable_automatic_plot_update();
};

update_plot = function() {
    // Skip if plotting not enabled
    if (!m_plotting_enabled) {
        return;
    }

    let $x_inputs = $(m_x_column_selector);
    let $y_inputs = $(m_y_column_selector);

    // Get values of inputs
    let x_values = $x_inputs.map(function() {
        return parseFloat($(this).val());
    }).get();

    // Get values of inputs
    let y_values = $y_inputs.map(function() {
        return parseFloat($(this).val());
    }).get();

    // Setup layout
    let layout = {
        autosize: true,
        height: 315,
        width: 300,
        margin: {l: 50, r: 0, t: 0, b: 40},
        xaxis: {
            title: m_x_column,
        },
        yaxis: {
            title: m_y_column,
        }
    };

    // Create series
    let series = {
        x: x_values,
        y: y_values,
        mode: 'lines+markers',
        type: 'scatter'
    };

    let data = [series];

    let out = Plotly.validate(data, layout);
    if (out) {
        $(out).each(function(index, item) {
            console.error(item.msg);
        });
        return;
    }

    // Update plot
    Plotly.react(m_plot, data, layout, m_plot_config).then(function(p) {
        // Resize plot to fit after rendering the first time
        fit_plot();
    });
};

fit_plot = function() {
//        let plot_container_width = $('#plot-slide-sheet').width();
//        Plotly.relayout(m_plot, {width: plot_container_width});
};

enable_automatic_plot_update = function() {
    // Skip if plotting not enabled
    if (!m_plotting_enabled) {
        return;
    }

    let $x_inputs = $(m_x_column_selector);
    let $y_inputs = $(m_y_column_selector);

    $x_inputs.on('change', function() {
        update_plot();
    });

    $y_inputs.on('change', function() {
        update_plot();
    });
};

disable_automatic_plot_update = function() {
    // Skip if plotting not enabled
    if (!m_plotting_enabled) {
        return;
    }

    let $x_inputs = $(m_x_column_selector);
    let $y_inputs = $(m_y_column_selector);

    $x_inputs.off('change');
    $y_inputs.off('change');
};

// Initialize table and plot capabilities
init_table_buttons();
parse_data();
init_paste();


// Utilities

function copy_text_to_clipboard(text) {
    if (!navigator.clipboard) {
        _fallback_copy_text_to_clipboard(text);
        return;
    }

    navigator.clipboard.writeText(text).then(function() {
        console.log('Async: Copying to clipboard was successful!');
    }, function(err) {
        console.error('Async: Could not copy text: ', err);
    });
}

function _fallback_copy_text_to_clipboard(text) {
    // Copy hack using hidden text area
    var text_area = document.createElement('textarea');
    text_area.value = text;
    document.body.appendChild(text_area);
    text_area.focus();
    text_area.select();

    try {
        document.execCommand('copy');
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
    }

    document.body.removeChild(text_area);
}