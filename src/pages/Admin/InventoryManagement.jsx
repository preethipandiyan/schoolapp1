import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, X, Search, Edit, Trash2, Download, Upload, ArrowUpDown, ChevronDown, Check, Settings
} from 'lucide-react';
import { LuPackage, LuServer, LuClipboardList } from 'react-icons/lu';
import { useAuth } from '../../context/AuthContext';
import usePermissions from '../../hooks/usePermissions';
import { 
  subscribeToSubCollection, 
  addSubDocument, 
  updateSubDocument, 
  deleteSubDocument
} from '../../firebase/firestore';
import ConfirmModal from '../../components/ConfirmModal';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import CustomFieldsRenderer from '../../components/CustomFieldsRenderer';
import { uploadCustomDataFiles } from '../../utils/cloudinary';

export default function InventoryManagement() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;
  const userName = userProfile?.name || userProfile?.email || 'Unknown User';
  const userRole = userProfile?.role || 'Staff';
  const { canCreate, canEdit, canDelete } = usePermissions();

  const [activeTab, setActiveTab] = useState('items'); // 'items' | 'categories'
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search/Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, statusFilter]);

  // Selected items for export
  const [selectedItemIds, setSelectedItemIds] = useState([]);

  // Modals
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFileName, setExportFileName] = useState('');
  const [confirmDeleteState, setConfirmDeleteState] = useState({ isOpen: false, type: '', id: null, name: '' });

  // Form states
  const [itemFormData, setItemFormData] = useState({ id: '', productId: '', name: '', category: '', quantity: 0, unit: 'pcs', status: 'In Stock', customData: {} });
  const [categoryFormData, setCategoryFormData] = useState({ id: '', name: '', description: '' });
  const [stockAdjustment, setStockAdjustment] = useState({ itemId: '', itemName: '', type: 'inbound', quantity: 1, remarks: '', prevStock: 0 });

  // Import config & states
  const [importConfig, setImportConfig] = useState({ autoCreateCategories: false, duplicateAction: 'skip' }); // 'skip' | 'update' | 'create-new'
  const [importFile, setImportFile] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [importErrors, setImportErrors] = useState([]);

  // Load inventory items and categories in real-time
  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);

    const unsubItems = subscribeToSubCollection(schoolId, 'inventory', (data) => {
      setItems(data);
      setLoading(false);
    });

    const unsubCategories = subscribeToSubCollection(schoolId, 'inventory_categories', (data) => {
      setCategories(data);
    });

    return () => {
      if (unsubItems) unsubItems();
      if (unsubCategories) unsubCategories();
    };
  }, [schoolId]);

  // Log audit helper
  const logAudit = async (actionType, details) => {
    if (!schoolId) return;
    try {
      await addSubDocument(schoolId, 'inventory_audit_logs', {
        timestamp: new Date().toISOString(),
        userName,
        userRole,
        actionType,
        ...details,
        ipAddress: '192.168.1.100' // Mocked IP Address
      });
    } catch (e) {
      console.error("Failed to write audit log:", e);
    }
  };

  // Item Save
  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!schoolId) return;

    // Validation
    const nameTrimmed = itemFormData.name.trim();
    if (!nameTrimmed) {
      toast.error("Product name is mandatory");
      return;
    }

    const prodIdTrimmed = itemFormData.productId.trim();
    if (prodIdTrimmed) {
      const isDuplicate = items.some(i => i.id !== itemFormData.id && i.productId?.toLowerCase() === prodIdTrimmed.toLowerCase());
      if (isDuplicate) {
        toast.error("Product ID must be unique");
        return;
      }
    }

    const categoryExists = categories.some(c => c.name.toLowerCase() === itemFormData.category.toLowerCase());
    if (!categoryExists && itemFormData.category) {
      // Create category dynamically
      try {
        const catId = await addSubDocument(schoolId, 'inventory_categories', {
          name: itemFormData.category,
          description: 'Auto-created during item creation'
        });
        await logAudit('Category Created', {
          category: itemFormData.category,
          remarks: 'Auto-created during item creation'
        });
      } catch (err) {
        toast.error("Failed to auto-create category");
        return;
      }
    }

    const qty = parseInt(itemFormData.quantity) || 0;
    const status = qty === 0 ? 'Out of Stock' : qty <= 10 ? 'Low Stock' : 'In Stock';

    const uploadedCustomData = await uploadCustomDataFiles(itemFormData.customData, schoolId, 'inventory');

    const finalData = {
      productId: prodIdTrimmed,
      name: nameTrimmed,
      category: itemFormData.category || 'Uncategorized',
      quantity: qty,
      unit: itemFormData.unit.trim() || 'pcs',
      status: status,
      customData: uploadedCustomData || {}
    };

    try {
      if (itemFormData.id) {
        // Edit Item
        const prevItem = items.find(i => i.id === itemFormData.id);
        await updateSubDocument(schoolId, 'inventory', itemFormData.id, finalData);
        await logAudit('Product Updated', {
          productName: nameTrimmed,
          productId: prodIdTrimmed,
          category: finalData.category,
          previousStock: prevItem?.quantity || 0,
          newStock: qty,
          quantityChanged: qty - (prevItem?.quantity || 0),
          remarks: 'Manual update'
        });
        toast.success("Item updated successfully");
      } else {
        // Create Item
        const docId = await addSubDocument(schoolId, 'inventory', finalData);
        await logAudit('Product Created', {
          productName: nameTrimmed,
          productId: prodIdTrimmed,
          category: finalData.category,
          previousStock: 0,
          newStock: qty,
          quantityChanged: qty,
          remarks: 'Manual creation'
        });
        toast.success("Item added successfully");
      }
      setShowItemModal(false);
    } catch (err) {
      toast.error("Failed to save inventory item");
    }
  };

  // Category Save
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!schoolId) return;

    const catName = categoryFormData.name.trim();
    if (!catName) {
      toast.error("Category name is required");
      return;
    }

    const finalData = {
      name: catName,
      description: categoryFormData.description.trim()
    };

    try {
      if (categoryFormData.id) {
        await updateSubDocument(schoolId, 'inventory_categories', categoryFormData.id, finalData);
        await logAudit('Category Updated', {
          category: catName,
          remarks: `Updated description: ${finalData.description}`
        });
        toast.success("Category updated");
      } else {
        await addSubDocument(schoolId, 'inventory_categories', finalData);
        await logAudit('Category Created', {
          category: catName,
          remarks: finalData.description
        });
        toast.success("Category created");
      }
      setShowCategoryModal(false);
    } catch (err) {
      toast.error("Failed to save category");
    }
  };

  // Stock Adjustment
  const handleStockAdjustment = async (e) => {
    e.preventDefault();
    if (!schoolId) return;

    const qtyVal = parseInt(stockAdjustment.quantity) || 0;
    if (qtyVal <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    const prevStock = stockAdjustment.prevStock;
    let newQty = prevStock;
    let actionType = '';

    if (stockAdjustment.type === 'inbound') {
      newQty = prevStock + qtyVal;
      actionType = 'Inbound Stock';
    } else {
      if (prevStock < qtyVal) {
        toast.error("Insufficient stock for outbound adjustment");
        return;
      }
      newQty = prevStock - qtyVal;
      actionType = 'Outbound Stock';
    }

    const status = newQty === 0 ? 'Out of Stock' : newQty <= 10 ? 'Low Stock' : 'In Stock';
    const targetItem = items.find(i => i.id === stockAdjustment.itemId);

    try {
      await updateSubDocument(schoolId, 'inventory', stockAdjustment.itemId, {
        quantity: newQty,
        status: status
      });
      await logAudit(actionType, {
        productName: stockAdjustment.itemName,
        productId: targetItem?.productId || '',
        category: targetItem?.category || '',
        previousStock: prevStock,
        newStock: newQty,
        quantityChanged: stockAdjustment.type === 'inbound' ? qtyVal : -qtyVal,
        remarks: stockAdjustment.remarks
      });
      toast.success("Stock adjusted successfully");
      setShowStockModal(false);
    } catch (err) {
      toast.error("Failed to adjust stock");
    }
  };

  // Delete Item or Category Execution
  const handleDeleteConfirm = async () => {
    if (!schoolId || !confirmDeleteState.id) return;
    try {
      if (confirmDeleteState.type === 'item') {
        const item = items.find(i => i.id === confirmDeleteState.id);
        await deleteSubDocument(schoolId, 'inventory', confirmDeleteState.id);
        await logAudit('Product Deleted', {
          productName: item?.name || '',
          productId: item?.productId || '',
          category: item?.category || '',
          previousStock: item?.quantity || 0,
          newStock: 0,
          quantityChanged: -(item?.quantity || 0),
          remarks: 'Manual deletion'
        });
        toast.success("Item deleted");
      } else {
        const cat = categories.find(c => c.id === confirmDeleteState.id);
        await deleteSubDocument(schoolId, 'inventory_categories', confirmDeleteState.id);
        await logAudit('Category Deleted', {
          category: cat?.name || '',
          remarks: 'Manual deletion'
        });
        toast.success("Category deleted");
      }
      setConfirmDeleteState({ isOpen: false, type: '', id: null, name: '' });
    } catch (err) {
      toast.error("Deletion failed");
    }
  };

  // Filter Items
  const filteredItems = items.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (i.productId && i.productId.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          i.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || i.category === categoryFilter;
    const matchesStatus = statusFilter === 'All' || i.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Pagination calculations
  const itemsPerPage = 10;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  // Checkbox handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedItemIds(filteredItems.map(i => i.id));
    } else {
      setSelectedItemIds([]);
    }
  };

  const handleSelectItem = (id) => {
    if (selectedItemIds.includes(id)) {
      setSelectedItemIds(selectedItemIds.filter(x => x !== id));
    } else {
      setSelectedItemIds([...selectedItemIds, id]);
    }
  };

  // Bulk Export execution
  const handleBulkExport = (format) => {
    let listToExport = [];
    if (selectedItemIds.length > 0) {
      listToExport = items.filter(i => selectedItemIds.includes(i.id));
    } else {
      listToExport = filteredItems;
    }

    if (listToExport.length === 0) {
      toast.error("No items to export");
      return;
    }

    const rows = listToExport.map(i => ({
      "ID Number": i.productId || '',
      "Product Name": i.name,
      "Category": i.category,
      "Current Stock": i.quantity,
      "Created Date": i.createdAt ? new Date(i.createdAt).toLocaleString() : '',
      "Last Updated Date": i.updatedAt ? new Date(i.updatedAt).toLocaleString() : ''
    }));

    const rawName = exportFileName.trim() || `inventory_products_${new Date().toISOString().slice(0,10)}`;
    
    if (format === 'csv') {
      const headers = ["ID Number", "Product Name", "Category", "Current Stock", "Created Date", "Last Updated Date"];
      const csvContent = [
        headers.join(","),
        ...rows.map(r => [
          `"${r["ID Number"]}"`,
          `"${r["Product Name"].replace(/"/g, '""')}"`,
          `"${r["Category"].replace(/"/g, '""')}"`,
          r["Current Stock"],
          `"${r["Created Date"]}"`,
          `"${r["Last Updated Date"]}"`
        ].join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      
      const finalFileName = rawName.toLowerCase().endsWith('.csv') ? rawName : `${rawName}.csv`;
      link.setAttribute("download", finalFileName);
      link.click();
    } else {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory Products");
      
      const finalFileName = rawName.toLowerCase().endsWith('.xlsx') ? rawName : `${rawName}.xlsx`;
      XLSX.writeFile(workbook, finalFileName);
    }

    logAudit('Bulk Export', {
      remarks: `Exported ${listToExport.length} products to ${format.toUpperCase()}`
    });
    setShowExportModal(false);
  };

  // Download Sample Template
  const handleDownloadTemplate = (format) => {
    const headers = [["ID Number", "Product Name", "Category", "Initial Stock"]];
    if (format === 'csv') {
      const csvContent = headers[0].join(",") + "\n";
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "inventory_import_template.csv");
      link.click();
    } else {
      const ws = XLSX.utils.aoa_to_sheet(headers);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      XLSX.writeFile(wb, "inventory_import_template.xlsx");
    }
  };

  // Bulk Import File Handler
  const handleImportFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);
    setImportSummary(null);
    setImportErrors([]);
  };

  // Bulk Import Processing
  const handleProcessImport = () => {
    if (!importFile) {
      toast.error("Please upload a file first");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target.result;
      let workbook;
      try {
        workbook = XLSX.read(bstr, { type: 'binary' });
      } catch (err) {
        toast.error("Failed to parse file. Ensure it is a valid CSV or Excel file.");
        return;
      }

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (data.length <= 1) {
        toast.error("Uploaded file has no data rows");
        return;
      }

      const headers = data[0].map(h => String(h).trim().toLowerCase());
      const idxId = headers.indexOf("id number");
      const idxName = headers.indexOf("product name");
      const idxCat = headers.indexOf("category");
      const idxStock = headers.indexOf("initial stock");

      if (idxName === -1 || idxCat === -1) {
        toast.error("Header columns 'Product Name' and 'Category' are mandatory in the template.");
        return;
      }

      let totalRows = 0;
      let successCount = 0;
      let failedCount = 0;
      let skippedCount = 0;
      const errors = [];
      const rowsToImport = [];
      const seenProductIds = new Set();
      const seenProductNames = new Set();

      for (let rIdx = 1; rIdx < data.length; rIdx++) {
        const row = data[rIdx];
        if (!row || row.length === 0 || row.every(val => val === null || val === undefined || String(val).trim() === '')) {
          continue; // Ignore completely empty rows
        }

        totalRows++;
        const rowNum = rIdx + 1;

        const rawId = idxId !== -1 ? String(row[idxId] || '').trim() : '';
        const rawName = String(row[idxName] || '').trim();
        const rawCat = String(row[idxCat] || '').trim();
        const rawStock = idxStock !== -1 ? parseInt(row[idxStock]) : 0;

        // Validation: Product Name
        if (!rawName) {
          failedCount++;
          errors.push({ row: rowNum, message: "Product Name is mandatory" });
          continue;
        }

        // Validation: Stock positive integer
        if (idxStock !== -1 && isNaN(rawStock)) {
          failedCount++;
          errors.push({ row: rowNum, message: "Initial Stock must be a positive integer" });
          continue;
        }

        // Check for duplicates inside file
        if (rawId && seenProductIds.has(rawId.toLowerCase())) {
          failedCount++;
          errors.push({ row: rowNum, message: `Duplicate ID Number "${rawId}" found within the file` });
          continue;
        }
        if (seenProductNames.has(rawName.toLowerCase())) {
          failedCount++;
          errors.push({ row: rowNum, message: `Duplicate Product Name "${rawName}" found within the file` });
          continue;
        }

        if (rawId) seenProductIds.add(rawId.toLowerCase());
        seenProductNames.add(rawName.toLowerCase());

        // Category validation
        const catExists = categories.some(c => c.name.toLowerCase() === rawCat.toLowerCase());
        if (!catExists) {
          if (!importConfig.autoCreateCategories) {
            failedCount++;
            errors.push({ row: rowNum, message: `Category "${rawCat}" does not exist, and auto-creation is disabled` });
            continue;
          }
        }

        rowsToImport.push({
          rowNum,
          productId: rawId,
          name: rawName,
          category: rawCat || 'Uncategorized',
          quantity: Math.max(0, rawStock || 0)
        });
      }

      // If validation errors are present, show summaries
      if (errors.length > 0) {
        setImportErrors(errors);
        setImportSummary({ totalRows, successCount: 0, failedCount: errors.length, skippedCount: 0 });
        toast.error(`${errors.length} validation errors found`);
        return;
      }

      // Now process writes in DB based on configuration
      for (const item of rowsToImport) {
        // Check if exists in db
        const existingItem = items.find(dbI => 
          (item.productId && dbI.productId?.toLowerCase() === item.productId.toLowerCase()) || 
          dbI.name.toLowerCase() === item.name.toLowerCase()
        );

        if (existingItem) {
          if (importConfig.duplicateAction === 'skip') {
            skippedCount++;
            continue;
          } else if (importConfig.duplicateAction === 'update') {
            // Update
            const finalQty = existingItem.quantity + item.quantity;
            const status = finalQty === 0 ? 'Out of Stock' : finalQty <= 10 ? 'Low Stock' : 'In Stock';
            await updateSubDocument(schoolId, 'inventory', existingItem.id, {
              quantity: finalQty,
              status: status,
              category: item.category
            });
            await logAudit('Product Updated', {
              productName: item.name,
              productId: item.productId,
              category: item.category,
              previousStock: existingItem.quantity,
              newStock: finalQty,
              quantityChanged: item.quantity,
              remarks: 'Updated via bulk import'
            });
            successCount++;
          } else {
            // Create only new products => skip
            skippedCount++;
            continue;
          }
        } else {
          // Create new
          // Ensure category is created first if missing
          const catExists = categories.some(c => c.name.toLowerCase() === item.category.toLowerCase());
          if (!catExists && importConfig.autoCreateCategories) {
            await addSubDocument(schoolId, 'inventory_categories', {
              name: item.category,
              description: 'Auto-created during bulk import'
            });
            await logAudit('Category Created', {
              category: item.category,
              remarks: 'Auto-created during bulk import'
            });
          }

          const status = item.quantity === 0 ? 'Out of Stock' : item.quantity <= 10 ? 'Low Stock' : 'In Stock';
          await addSubDocument(schoolId, 'inventory', {
            productId: item.productId,
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            unit: 'pcs',
            status: status
          });
          await logAudit('Product Created', {
            productName: item.name,
            productId: item.productId,
            category: item.category,
            previousStock: 0,
            newStock: item.quantity,
            quantityChanged: item.quantity,
            remarks: 'Created via bulk import'
          });
          successCount++;
        }
      }

      setImportSummary({ totalRows, successCount, failedCount, skippedCount });
      await logAudit('Bulk Import', {
        remarks: `Bulk import completed: ${successCount} imported, ${skippedCount} skipped, ${failedCount} failed`
      });
      toast.success("Bulk import completed successfully");
    };

    reader.readAsBinaryString(importFile);
  };

  // Download error logs report
  const downloadErrorReport = () => {
    if (importErrors.length === 0) return;
    const csvContent = "Row Number,Validation Error Message\n" + 
      importErrors.map(e => `${e.row},"${e.message.replace(/"/g, '""')}"`).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `import_error_report_${new Date().toISOString().slice(0,10)}.csv`);
    link.click();
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto flex flex-col min-w-0 min-h-screen pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 shrink-0 w-full">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3 truncate">
            <LuPackage className="text-primary-600 shrink-0" /> <span className="truncate">Inventory & Assets</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Track school assets, stock, and inventory.</p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button 
            onClick={() => navigate('/admin/inventory/audit-logs')}
            className="w-full sm:w-auto justify-center flex items-center gap-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-semibold"
          >
            <LuClipboardList size={18} /> Audit Logs
          </button>
          
          {canCreate('inventory') && (
            <button 
              onClick={() => setShowImportModal(true)}
              className="w-full sm:w-auto justify-center flex items-center gap-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-semibold"
            >
              <Upload size={18} /> Bulk Import
            </button>
          )}

           <button 
            onClick={() => {
              if (items.length === 0) {
                toast.error("No inventory data available to export.");
                return;
              }
              setExportFileName('inventory_products_' + new Date().toISOString().slice(0,10));
              setShowExportModal(true);
            }}
            className="w-full sm:w-auto justify-center flex items-center gap-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-semibold"
          >
            <Download size={18} /> Bulk Export
          </button>

          {activeTab === 'items' ? (
            canCreate('inventory') ? (
              <button 
                onClick={() => { setItemFormData({ id: '', productId: '', name: '', category: '', quantity: 0, unit: 'pcs', status: 'In Stock' }); setShowItemModal(true); }}
                className="w-full sm:w-auto justify-center flex items-center gap-2 bg-primary-600 text-white px-5 py-2 rounded-xl hover:bg-primary-700 transition-all font-semibold shadow-sm"
              >
                <Plus size={18} /> Add Item
              </button>
            ) : null
          ) : (
            canCreate('inventory') ? (
              <button 
                onClick={() => { setCategoryFormData({ id: '', name: '', description: '' }); setShowCategoryModal(true); }}
                className="w-full sm:w-auto justify-center flex items-center gap-2 bg-primary-600 text-white px-5 py-2 rounded-xl hover:bg-primary-700 transition-all font-semibold shadow-sm"
              >
                <Plus size={18} /> Add Category
              </button>
            ) : null
          )}
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 mb-6 shrink-0 gap-4 overflow-x-auto w-full custom-scrollbar">
        <button 
          onClick={() => setActiveTab('items')}
          className={`pb-3 text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'items' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          Inventory Items ({items.length})
        </button>
        <button 
          onClick={() => setActiveTab('categories')}
          className={`pb-3 text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'categories' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          Categories ({categories.length})
        </button>
      </div>

      {activeTab === 'items' ? (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6 shrink-0">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center">
                <LuPackage size={20} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Items</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{items.length}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                <LuServer size={20} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Low Stock Alerts</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{items.filter(i => i.status === 'Low Stock').length}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
                <LuPackage size={20} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Out of Stock</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{items.filter(i => i.status === 'Out of Stock').length}</p>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm mb-4">
            {/* Filters Row */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col sm:flex-row gap-3 shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300" size={18} />
                <input 
                  type="text"
                  placeholder="Search by name, product ID or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <select 
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold"
              >
                <option value="All">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold"
              >
                <option value="All">All Statuses</option>
                <option value="In Stock">In Stock</option>
                <option value="Low Stock">Low Stock</option>
                <option value="Out of Stock">Out of Stock</option>
              </select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto w-full min-w-0">
              <table className="w-full text-left border-collapse min-w-max">
                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                  <tr className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase">
                    <th className="p-4 pl-6 w-12">
                      <input 
                        type="checkbox" 
                        onChange={handleSelectAll} 
                        checked={filteredItems.length > 0 && selectedItemIds.length === filteredItems.length}
                        className="rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500 h-4.5 w-4.5"
                      />
                    </th>
                    <th className="p-4">Product ID</th>
                    <th className="p-4">Product Name</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Current Stock</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {paginatedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 pl-6">
                        <input 
                          type="checkbox" 
                          checked={selectedItemIds.includes(item.id)} 
                          onChange={() => handleSelectItem(item.id)}
                          className="rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500 h-4.5 w-4.5"
                        />
                      </td>
                      <td className="p-4 font-semibold text-slate-500 dark:text-slate-400">{item.productId || '—'}</td>
                      <td className="p-4 font-bold text-slate-900 dark:text-white">{item.name}</td>
                      <td className="p-4 text-slate-600 dark:text-slate-300 font-medium">{item.category}</td>
                      <td className="p-4 font-bold text-slate-900 dark:text-white">{item.quantity} {item.unit}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          item.status === 'In Stock' ? 'bg-emerald-100 text-emerald-700' : 
                          item.status === 'Out of Stock' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canEdit('inventory') && (
                            <button 
                              onClick={() => { setStockAdjustment({ itemId: item.id, itemName: item.name, type: 'inbound', quantity: 1, remarks: '', prevStock: item.quantity }); setShowStockModal(true); }}
                              className="px-2 py-1 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                            >
                              Adjust Stock
                            </button>
                          )}
                          {canEdit('inventory') && (
                            <button onClick={() => { setItemFormData(item); setShowItemModal(true); }} className="p-2 text-slate-400 dark:text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                              <Edit size={16} />
                            </button>
                          )}
                          {canDelete('inventory') && (
                            <button onClick={() => setConfirmDeleteState({ isOpen: true, type: 'item', id: item.id, name: item.name })} className="p-2 text-slate-400 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan="7" className="p-12 text-center text-slate-500 dark:text-slate-400 font-medium">
                        No inventory products found matching filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-b-3xl">
                <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  Showing <span className="font-semibold text-slate-900 dark:text-white">{indexOfFirstItem + 1}</span> to{' '}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {Math.min(indexOfLastItem, filteredItems.length)}
                  </span>{' '}
                  of <span className="font-semibold text-slate-900 dark:text-white">{filteredItems.length}</span> products
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3.5 py-2 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`h-9 w-9 flex items-center justify-center rounded-xl text-sm font-bold transition-all ${
                          currentPage === pageNum
                            ? 'bg-primary-600 text-white shadow-sm'
                            : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3.5 py-2 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Categories Tab */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm mb-4">
          <div className="overflow-x-auto w-full min-w-0">
            <table className="w-full text-left border-collapse min-w-max">
              <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                <tr className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase">
                  <th className="p-4 pl-6">Category Name</th>
                  <th className="p-4">Description</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 pl-6 font-bold text-slate-900 dark:text-white">{cat.name}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-300">{cat.description || 'No description provided'}</td>
                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canEdit('inventory') && (
                          <button onClick={() => { setCategoryFormData(cat); setShowCategoryModal(true); }} className="p-2 text-slate-400 dark:text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                            <Edit size={16} />
                          </button>
                        )}
                        {canDelete('inventory') && (
                          <button onClick={() => setConfirmDeleteState({ isOpen: true, type: 'category', id: cat.id, name: cat.name })} className="p-2 text-slate-400 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {categories.length === 0 && (
                  <tr>
                    <td colSpan="3" className="p-12 text-center text-slate-500 dark:text-slate-400 font-medium">
                      No categories found. Create a category to start organizing inventory.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800 shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{itemFormData.id ? 'Edit' : 'Add'} Inventory Product</h2>
              <button onClick={() => setShowItemModal(false)} className="text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full p-2 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveItem} className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Product ID (Unique, Optional)</label>
                  <input 
                    type="text" 
                    value={itemFormData.productId} onChange={e => setItemFormData({...itemFormData, productId: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 text-black bg-white dark:bg-slate-900"
                    placeholder="e.g. PROD-102"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Product Name (Mandatory)</label>
                  <input 
                    type="text" required
                    value={itemFormData.name} onChange={e => setItemFormData({...itemFormData, name: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 text-black bg-white dark:bg-slate-900"
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Category</label>
                    <select 
                      required
                      value={itemFormData.category} onChange={e => setItemFormData({...itemFormData, category: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 text-black bg-white dark:bg-slate-900"
                    >
                      <option value="">-- Choose Category --</option>
                      {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Unit</label>
                    <input 
                      type="text" required
                      value={itemFormData.unit} onChange={e => setItemFormData({...itemFormData, unit: e.target.value})}
                      placeholder="e.g. pcs, boxes"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 text-black bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Initial Stock Quantity</label>
                  <input 
                    type="number" required min="0"
                    disabled={!!itemFormData.id}
                    value={itemFormData.quantity} onChange={e => setItemFormData({...itemFormData, quantity: parseInt(e.target.value) || 0})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 text-black bg-white dark:bg-slate-900 disabled:opacity-50"
                  />
                </div>
                
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <CustomFieldsRenderer 
                    moduleKey="inventory"
                    customData={itemFormData.customData}
                    onChange={(fieldId, value) => {
                      setItemFormData(prev => ({
                        ...prev,
                        customData: {
                          ...(prev.customData || {}),
                          [fieldId]: value
                        }
                      }));
                    }}
                  />
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setShowItemModal(false)} className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 rounded-xl shadow-sm transition-colors">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800 shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{categoryFormData.id ? 'Edit' : 'Add'} Category</h2>
              <button onClick={() => setShowCategoryModal(false)} className="text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full p-2 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveCategory} className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Category Name</label>
                  <input 
                    type="text" required
                    value={categoryFormData.name} onChange={e => setCategoryFormData({...categoryFormData, name: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 text-black bg-white dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Description (Optional)</label>
                  <textarea 
                    value={categoryFormData.description} onChange={e => setCategoryFormData({...categoryFormData, description: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 text-black bg-white dark:bg-slate-900 h-24"
                  />
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setShowCategoryModal(false)} className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 rounded-xl shadow-sm transition-colors">Save Category</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {showStockModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800 shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Adjust Stock: {stockAdjustment.itemName}</h2>
              <button onClick={() => setShowStockModal(false)} className="text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full p-2 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleStockAdjustment} className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-6 space-y-5">
                <div className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex-1 text-center border-r border-slate-200 dark:border-slate-700">
                    <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Previous Stock</span>
                    <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{stockAdjustment.prevStock}</span>
                  </div>
                  <div className="flex-1 text-center">
                    <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">New Stock</span>
                    <span className="text-xl font-bold text-primary-600">
                      {stockAdjustment.type === 'inbound' 
                        ? stockAdjustment.prevStock + (parseInt(stockAdjustment.quantity) || 0)
                        : Math.max(0, stockAdjustment.prevStock - (parseInt(stockAdjustment.quantity) || 0))
                      }
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Adjustment Type</label>
                  <div className="flex gap-4">
                    <label className="flex-1 flex items-center justify-center gap-2 p-3 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-black">
                      <input 
                        type="radio" 
                        name="stock-type" 
                        value="inbound" 
                        checked={stockAdjustment.type === 'inbound'} 
                        onChange={() => setStockAdjustment({...stockAdjustment, type: 'inbound'})}
                        className="text-primary-600"
                      />
                      Inbound Stock
                    </label>
                    <label className="flex-1 flex items-center justify-center gap-2 p-3 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-black">
                      <input 
                        type="radio" 
                        name="stock-type" 
                        value="outbound" 
                        checked={stockAdjustment.type === 'outbound'} 
                        onChange={() => setStockAdjustment({...stockAdjustment, type: 'outbound'})}
                        className="text-primary-600"
                      />
                      Outbound Stock
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Adjustment Quantity</label>
                  <input 
                    type="number" required min="1"
                    value={stockAdjustment.quantity} onChange={e => setStockAdjustment({...stockAdjustment, quantity: parseInt(e.target.value) || 1})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 text-black bg-white dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Remarks / Reason (Optional)</label>
                  <textarea 
                    value={stockAdjustment.remarks} onChange={e => setStockAdjustment({...stockAdjustment, remarks: e.target.value})}
                    placeholder="e.g. Received new shipment, Damaged item audit..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 text-black bg-white dark:bg-slate-900 h-20"
                  />
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setShowStockModal(false)} className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 rounded-xl shadow-sm transition-colors">Save Adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800 shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Bulk Import Products</h2>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full p-2 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
              {/* Sample template buttons */}
              <div className="p-4 bg-primary-50 border border-primary-100 rounded-2xl flex flex-col gap-2">
                <span className="text-sm font-bold text-primary-900">Download Template</span>
                <span className="text-xs text-primary-600">Download the required layout template with mapping columns.</span>
                <div className="flex gap-2 mt-1">
                  <button 
                    onClick={() => handleDownloadTemplate('xlsx')} 
                    className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-primary-200 text-primary-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-primary-100 dark:hover:bg-slate-700 transition-all"
                  >
                    <Download size={14} /> Excel Template
                  </button>
                  <button 
                    onClick={() => handleDownloadTemplate('csv')} 
                    className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-primary-200 text-primary-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-primary-100 dark:hover:bg-slate-700 transition-all"
                  >
                    <Download size={14} /> CSV Template
                  </button>
                </div>
              </div>

              {/* Settings / Configs */}
              <div className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">Import Configuration</span>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">If Product Already Exists</label>
                  <select 
                    value={importConfig.duplicateAction} 
                    onChange={e => setImportConfig({...importConfig, duplicateAction: e.target.value})}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm font-semibold focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="skip">Skip Existing Products</option>
                    <option value="update">Update Existing Products (Add Quantity)</option>
                    <option value="create-new">Create Only New Products</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/50">
                  <div>
                    <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">Auto-create Categories</span>
                    <span className="block text-xs text-slate-400 dark:text-slate-300">If category doesn't exist, create it dynamically instead of rejecting row</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={importConfig.autoCreateCategories} 
                    onChange={e => setImportConfig({...importConfig, autoCreateCategories: e.target.checked})}
                    className="rounded text-primary-600 focus:ring-primary-500 h-5 w-5"
                  />
                </div>
              </div>

              {/* Upload Input */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                <label className="block text-sm font-bold text-slate-800 dark:text-slate-100 mb-2">Select Upload File (.xlsx or .csv)</label>
                <input 
                  type="file" 
                  accept=".csv, .xlsx"
                  onChange={handleImportFileChange}
                  className="w-full px-3 py-2.5 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-sm"
                />
              </div>

              {/* Summaries & Error logs */}
              {importSummary && (
                <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                  <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">Import Processed</span>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl">
                      <span className="block font-bold text-slate-700 dark:text-slate-200">{importSummary.totalRows}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Total Rows</span>
                    </div>
                    <div className="p-2 bg-emerald-50 text-emerald-800 rounded-xl">
                      <span className="block font-bold">{importSummary.successCount}</span>
                      <span className="text-[10px] uppercase">Success</span>
                    </div>
                    <div className="p-2 bg-amber-50 text-amber-800 rounded-xl">
                      <span className="block font-bold">{importSummary.skippedCount}</span>
                      <span className="text-[10px] uppercase">Skipped</span>
                    </div>
                    <div className="p-2 bg-red-50 text-red-800 rounded-xl">
                      <span className="block font-bold">{importSummary.failedCount}</span>
                      <span className="text-[10px] uppercase">Failed</span>
                    </div>
                  </div>
                </div>
              )}

              {importErrors.length > 0 && (
                <div className="border border-red-200 bg-red-50/50 p-4 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-red-900">Validation Error Details</span>
                    <button 
                      onClick={downloadErrorReport}
                      className="text-xs text-red-700 font-bold underline flex items-center gap-1"
                    >
                      <Download size={12} /> Download Error Log
                    </button>
                  </div>
                  <div className="max-h-32 overflow-y-auto text-xs text-red-600 space-y-1 custom-scrollbar">
                    {importErrors.map((e, idx) => (
                      <p key={idx}>• Row {e.row}: {e.message}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setShowImportModal(false)} className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors">Close</button>
              <button 
                type="button" 
                onClick={handleProcessImport}
                disabled={!importFile}
                className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 rounded-xl shadow-sm transition-colors disabled:opacity-50"
              >
                Import Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800 shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Export Inventory Data</h2>
              <button onClick={() => setShowExportModal(false)} className="text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full p-2 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* File Name Input */}
              <div className="space-y-1.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">File Name</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. inventory_products"
                    value={exportFileName}
                    onChange={(e) => setExportFileName(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm font-semibold"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm space-y-1">
                <span className="block font-bold text-slate-700 dark:text-slate-200">Export Summary Scope</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {selectedItemIds.length > 0 
                    ? `Exporting ${selectedItemIds.length} Selected items` 
                    : `Exporting ${filteredItems.length} Filtered items (matching active filters)`
                  }
                </span>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Export Data Format</label>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => handleBulkExport('xlsx')}
                    className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 flex flex-col items-center justify-center gap-2 font-bold"
                  >
                    <Download size={24} className="text-emerald-600" />
                    Excel (.xlsx)
                  </button>
                  <button 
                    onClick={() => handleBulkExport('csv')}
                    className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 flex flex-col items-center justify-center gap-2 font-bold"
                  >
                    <Download size={24} className="text-blue-600" />
                    CSV (.csv)
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setShowExportModal(false)} className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Deletion Modal */}
      <ConfirmModal 
        isOpen={confirmDeleteState.isOpen}
        onClose={() => setConfirmDeleteState({ isOpen: false, type: '', id: null, name: '' })}
        onConfirm={handleDeleteConfirm}
        title={confirmDeleteState.type === 'item' ? "Delete Product" : "Delete Category"}
        message={`Are you sure you want to delete "${confirmDeleteState.name}"? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
}
