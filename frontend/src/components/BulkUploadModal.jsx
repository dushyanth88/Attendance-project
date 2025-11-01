import { useState, useRef } from 'react';
import { apiFetch } from '../utils/apiFetch';
import Toast from './Toast';
import * as XLSX from 'xlsx';

const BulkUploadModal = ({ isOpen, onClose, onStudentsAdded, classInfo }) => {
  const [step, setStep] = useState(1); // 1: Upload, 2: Preview, 3: Validation, 4: Processing, 5: Complete
  const [file, setFile] = useState(null);
  const [fileData, setFileData] = useState([]);
  const [validationResults, setValidationResults] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      // Validate file type
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'text/csv', // .csv
        'application/csv' // .csv
      ];
      
      const fileExtension = selectedFile.name.split('.').pop().toLowerCase();
      const isValidType = allowedTypes.includes(selectedFile.type) || 
                         ['xlsx', 'xls', 'csv'].includes(fileExtension);
      
      if (!isValidType) {
        setToast({
          show: true,
          message: 'Invalid file type. Please upload Excel (.xlsx, .xls) or CSV (.csv) files only.',
          type: 'error'
        });
        return;
      }
      
      // Validate file size (5MB limit)
      if (selectedFile.size > 5 * 1024 * 1024) {
        setToast({
          show: true,
          message: 'File size too large. Please upload files smaller than 5MB.',
          type: 'error'
        });
        return;
      }
      
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  const parseFile = async (file) => {
    try {
      setLoading(true);
      console.log('Starting file parse for:', file.name, 'Type:', file.type, 'Size:', file.size);
      
      const data = await parseFileContent(file);
      console.log('File parsed successfully, data:', data);
      console.log('Number of rows:', data.length);
      console.log('First row:', data[0]);
      
      if (data.length === 0) {
        throw new Error('No data found in the file. Please check the file format and try again.');
      }
      
      setFileData(data);
      setStep(2);
    } catch (error) {
      console.error('File parsing error:', error);
      console.error('Error stack:', error.stack);
      setToast({
        show: true,
        message: `Error parsing file: ${error.message}`,
        type: 'error'
      });
      // Reset to step 1 on error
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const parseFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          // Check if the event and target are valid
          if (!e || !e.target) {
            reject(new Error('Invalid file reading event'));
            return;
          }
          
          const data = e.target.result;
          if (!data) {
            reject(new Error('No data received from file'));
            return;
          }
          
          // Check if data is valid ArrayBuffer
          if (!(data instanceof ArrayBuffer)) {
            reject(new Error('Invalid file data format'));
            return;
          }
          
          let jsonData = [];
          
          // Check file type
          const fileExtension = file.name.split('.').pop().toLowerCase();
          console.log('File extension:', fileExtension);
          console.log('File type:', file.type);
          
          if (fileExtension === 'csv' || file.type === 'text/csv' || file.type === 'application/csv') {
            // Parse CSV file
            console.log('Parsing CSV file...');
            const text = new TextDecoder('utf-8').decode(data);
            const lines = text.split('\n').filter(line => line.trim());
            if (lines.length < 2) {
              reject(new Error('CSV file must have at least a header row and one data row'));
              return;
            }
            
            // Improved CSV parsing to handle quotes and different delimiters
            const parseCSVLine = (line) => {
              const result = [];
              let current = '';
              let inQuotes = false;
              
              for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                  inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                  result.push(current.trim());
                  current = '';
                } else {
                  current += char;
                }
              }
              result.push(current.trim());
              return result;
            };
            
            const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g, '').trim());
            console.log('CSV headers:', headers);
            
            jsonData = lines.slice(1).map((line, index) => {
              const values = parseCSVLine(line).map(v => v.replace(/"/g, '').trim());
              const row = {};
              headers.forEach((header, i) => {
                row[header] = values[i] || '';
              });
              return row;
            });
          } else if (fileExtension === 'xlsx' || fileExtension === 'xls' || 
                     file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                     file.type === 'application/vnd.ms-excel') {
            // Parse Excel file
            console.log('Parsing Excel file...');
            console.log('Data is ArrayBuffer:', data instanceof ArrayBuffer);
            
            // Convert ArrayBuffer to Uint8Array for XLSX
            const uint8Array = new Uint8Array(data);
            console.log('Uint8Array length:', uint8Array.length);
            
            const workbook = XLSX.read(uint8Array, { type: 'array' });
            console.log('Workbook created, sheet names:', workbook.SheetNames);
            
            const sheetName = workbook.SheetNames[0];
            console.log('Excel sheet name:', sheetName);
            
            if (!sheetName) {
              reject(new Error('No worksheets found in Excel file'));
              return;
            }
            
            const worksheet = workbook.Sheets[sheetName];
            console.log('Worksheet loaded');
            
            jsonData = XLSX.utils.sheet_to_json(worksheet, { 
              header: 1,
              defval: '',
              blankrows: false
            });
            
            console.log('Raw Excel data:', jsonData);
            console.log('Excel data length:', jsonData.length);
            
            // Convert array of arrays to array of objects
            if (jsonData.length > 0) {
              const headers = jsonData[0];
              console.log('Excel headers:', headers);
              
              if (!headers || headers.length === 0) {
                reject(new Error('No headers found in Excel file'));
                return;
              }
              
              jsonData = jsonData.slice(1).map(row => {
                const obj = {};
                headers.forEach((header, i) => {
                  obj[header] = row[i] || '';
                });
                return obj;
              });
            }
          } else {
            reject(new Error('Unsupported file type. Please upload Excel (.xlsx, .xls) or CSV (.csv) files only.'));
            return;
          }
          
          console.log('Parsed data:', jsonData);
          console.log('Number of rows:', jsonData.length);
          
          if (jsonData.length === 0) {
            reject(new Error('No data found in the file'));
            return;
          }
          
          // Filter out empty rows
          jsonData = jsonData.filter(row => {
            return Object.values(row).some(value => value && value.toString().trim() !== '');
          });
          
          console.log('Filtered data rows:', jsonData.length);
          
          if (jsonData.length === 0) {
            reject(new Error('No valid data rows found in the file'));
            return;
          }
          
          resolve(jsonData);
        } catch (error) {
          console.error('File parsing error:', error);
          reject(new Error(`Error parsing file: ${error.message}`));
        }
      };
      
      reader.onerror = (error) => {
        console.error('FileReader error:', error);
        reject(new Error('Error reading file. Please make sure the file is not corrupted and try again.'));
      };
      
      reader.onabort = () => {
        reject(new Error('File reading was aborted'));
      };
      
      // Use ArrayBuffer for better compatibility
      reader.readAsArrayBuffer(file);
    });
  };

  const normalizeStudentData = (student) => {
    const normalized = {};
    
    // Map various field name variations to standard names
    const fieldMappings = {
      rollNumber: ['Roll Number', 'rollNumber', 'RollNumber', 'roll_number', 'Roll_Number', 'Roll No', 'rollNo', 'RollNo'],
      name: ['Name', 'name', 'Student Name', 'studentName', 'student_name', 'Full Name', 'fullName', 'full_name'],
      email: ['Email', 'email', 'Email Address', 'emailAddress', 'email_address', 'E-mail', 'e_mail'],
      mobile: ['Mobile', 'mobile', 'Mobile Number', 'mobileNumber', 'mobile_number', 'Phone', 'phone', 'Phone Number'],
      parentContact: ['Parent Contact', 'parentContact', 'parent_contact', 'Parent Phone', 'parentPhone', 'parent_phone'],
      password: ['Password', 'password', 'Pass', 'pass']
    };
    
    Object.keys(fieldMappings).forEach(standardField => {
      const variations = fieldMappings[standardField];
      for (const variation of variations) {
        if (student[variation] !== undefined && student[variation] !== null && student[variation] !== '') {
          normalized[standardField] = student[variation];
          break;
        }
      }
    });
    
    return normalized;
  };

  const validateData = () => {
    const errors = [];
    const validStudents = [];
    const duplicateCheck = { rollNumbers: new Set(), emails: new Set() };
    
    fileData.forEach((student, index) => {
      const studentErrors = [];
      const rowNumber = index + 2; // +2 because we skip header and arrays are 0-indexed
      
      // Normalize field names
      const normalizedStudent = normalizeStudentData(student);
      
      // Required fields validation
      if (!normalizedStudent.rollNumber || !normalizedStudent.rollNumber.toString().trim()) {
        studentErrors.push('Roll Number is required');
      } else {
        const rollNumber = normalizedStudent.rollNumber.toString().trim();
        if (duplicateCheck.rollNumbers.has(rollNumber)) {
          studentErrors.push('Duplicate roll number in file');
        } else {
          duplicateCheck.rollNumbers.add(rollNumber);
        }
      }
      
      if (!normalizedStudent.name || !normalizedStudent.name.toString().trim()) {
        studentErrors.push('Name is required');
      }
      
      if (!normalizedStudent.email || !normalizedStudent.email.toString().trim()) {
        studentErrors.push('Email is required');
      } else {
        const email = normalizedStudent.email.toString().trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          studentErrors.push('Invalid email format');
        } else if (duplicateCheck.emails.has(email)) {
          studentErrors.push('Duplicate email in file');
        } else {
          duplicateCheck.emails.add(email);
        }
      }
      
      // Optional fields validation
      if (normalizedStudent.mobile && !/^[0-9]{10}$/.test(normalizedStudent.mobile.toString().trim())) {
        studentErrors.push('Mobile number must be exactly 10 digits');
      }
      
      if (normalizedStudent.parentContact && !/^[0-9]{10}$/.test(normalizedStudent.parentContact.toString().trim())) {
        studentErrors.push('Parent contact must be exactly 10 digits');
      }
      
      if (normalizedStudent.password && normalizedStudent.password.toString().trim().length < 6) {
        studentErrors.push('Password must be at least 6 characters');
      }
      
      if (studentErrors.length > 0) {
        errors.push({
          rowNumber,
          data: normalizedStudent,
          errors: studentErrors
        });
      } else {
        validStudents.push(normalizedStudent);
      }
    });
    
    setValidationResults({
      validStudents,
      invalidStudents: errors,
      totalRows: fileData.length
    });
    setStep(3);
  };

  const handleUpload = async () => {
    try {
      setLoading(true);
      setStep(4);
      setUploadProgress(0);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('batch', classInfo.batch);
      formData.append('year', classInfo.year);
      formData.append('semester', classInfo.semester);
      formData.append('section', classInfo.section || 'A');
      formData.append('department', classInfo.department);
      
      console.log('📤 Upload context:', {
        batch: classInfo.batch,
        year: classInfo.year,
        semester: classInfo.semester,
        section: classInfo.section || 'A',
        department: classInfo.department
      });
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);
      
      // Use direct fetch for file uploads as apiFetch might not handle multipart correctly
      // const accessToken = localStorage.getItem('accessToken');
      // const response = await fetch('/api/students/bulk-upload', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${accessToken}`
      //   },
      //   body: formData
      // });
      const response = await apiFetch({
        url: '/api/students/bulk-upload',
        method: 'POST',
        data: formData,
        headers: {} // let apiFetch auto-handle Authorization token
      });
      const responseData = response.data;
      
      if (!responseData.success) {
        throw new Error(responseData.message || 'Upload failed');
      }
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (responseData.success) {
        setUploadResults(responseData);
        setStep(5);
        
        // Show success message with detailed summary
        const { addedCount, skippedCount, errorCount } = responseData.summary;
        let message = `Upload completed successfully! `;
        
        if (addedCount > 0) {
          message += `✅ ${addedCount} students added. `;
        }
        if (skippedCount > 0) {
          message += `⚠️ ${skippedCount} students skipped (already exist). `;
        }
        if (errorCount > 0) {
          message += `❌ ${errorCount} students had errors. `;
        }
        
        if (addedCount === 0 && skippedCount === 0 && errorCount > 0) {
          message = 'No students were added. Please verify your CSV format and try again.';
        }
        
        setToast({
          show: true,
          message,
          type: addedCount > 0 ? 'success' : 'warning'
        });
        
        // Refresh students list with upload results
        if (onStudentsAdded) {
          onStudentsAdded(responseData);
        }
      } else {
        throw new Error(responseData.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setToast({
        show: true,
        message: error.message || 'Upload failed. Please try again.',
        type: 'error'
      });
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const testAuth = async () => {
    try {
      console.log('Testing authentication...');
      const response = await apiFetch({
        url: '/api/bulk-upload/test-auth',
        method: 'GET'
      });
      console.log('Auth test successful:', response.data);
      return true;
    } catch (error) {
      console.error('Auth test failed:', error);
      return false;
    }
  };

  const downloadTemplate = async () => {
    try {
      console.log('Downloading template...');
      
      // Check authentication status
      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');
      console.log('Access token exists:', !!accessToken);
      console.log('Refresh token exists:', !!refreshToken);
      
      if (!accessToken) {
        throw new Error('No access token found. Please log in again.');
      }
      
      // Test authentication first
      const authTest = await testAuth();
      if (!authTest) {
        throw new Error('Authentication test failed. Please log in again.');
      }
      
      const response = await apiFetch({
        url: '/api/bulk-upload/template',
        method: 'GET',
        responseType: 'blob'
      });
      
      console.log('Response received:', response);
      console.log('Response data type:', typeof response.data);
      console.log('Response data size:', response.data?.length || 'unknown');
      
      if (response.data) {
        const blob = new Blob([response.data], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        console.log('Blob size:', blob.size);
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'student_template.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        console.log('Template downloaded successfully');
        
        setToast({
          show: true,
          message: 'Template downloaded successfully!',
          type: 'success'
        });
      } else {
        throw new Error('No data received from server');
      }
    } catch (error) {
      console.error('Template download error:', error);
      console.error('Error details:', error.response?.data);
      
      let errorMessage = 'Failed to download template';
      if (error.response?.status === 401) {
        errorMessage = 'Authentication failed. Please log in again.';
      } else if (error.response?.status === 403) {
        errorMessage = 'Access denied. You do not have permission to download templates.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setToast({
        show: true,
        message: errorMessage,
        type: 'error'
      });
    }
  };

  const resetModal = () => {
    setStep(1);
    setFile(null);
    setFileData([]);
    setValidationResults(null);
    setUploadProgress(0);
    setUploadResults(null);
    setLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
          <div className="mt-3">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                Bulk Upload Students
              </h3>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Progress Indicator */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span>Step {step} of 5</span>
                <span>{Math.round((step / 5) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(step / 5) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Step 1: File Upload */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                    <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Upload Student File</h4>
                  <p className="text-gray-600 mb-6">
                    Upload an Excel (.xlsx) or CSV file containing student information
                  </p>
                </div>

                {/* File Format Instructions */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h5 className="font-medium text-gray-900 mb-2">Required Columns:</h5>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div>• Roll Number</div>
                    <div>• Name</div>
                    <div>• Email</div>
                    <div>• Mobile</div>
                    <div>• Parent Contact</div>
                    <div>• Password (optional)</div>
                  </div>
                </div>

                {/* Template Download */}
                <div className="text-center mb-6">
                  <button
                    onClick={downloadTemplate}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    📥 Download Sample Template
                  </button>
                </div>

                {/* File Upload */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    disabled={loading}
                  >
                    {loading ? 'Processing...' : 'Choose File'}
                  </button>
                  <p className="text-gray-500 text-sm mt-2">
                    Supported formats: Excel (.xlsx, .xls), CSV (.csv)
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: File Preview */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h4 className="text-lg font-medium text-gray-900 mb-2">File Preview</h4>
                  <p className="text-gray-600">
                    Review the data from your file ({fileData.length} rows found)
                  </p>
                </div>

                <div className="max-h-96 overflow-auto border rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {Object.keys(fileData[0] || {}).map((header, index) => (
                          <th key={index} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {fileData.slice(0, 10).map((row, index) => (
                        <tr key={index}>
                          {Object.values(row).map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-4 py-2 text-sm text-gray-900">
                              {cell?.toString() || ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {fileData.length > 10 && (
                    <div className="text-center py-2 text-sm text-gray-500">
                      ... and {fileData.length - 10} more rows
                    </div>
                  )}
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setStep(1)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                  >
                    Back
                  </button>
                  <button
                    onClick={validateData}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                  >
                    Validate Data
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Validation Results */}
            {step === 3 && validationResults && (
              <div className="space-y-6">
                <div className="text-center">
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Validation Results</h4>
                  <p className="text-gray-600">
                    Review validation results before uploading
                  </p>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {validationResults.validStudents.length}
                    </div>
                    <div className="text-sm text-green-800">Valid Students</div>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {validationResults.invalidStudents.length}
                    </div>
                    <div className="text-sm text-yellow-800">Invalid Rows</div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {validationResults.totalRows}
                    </div>
                    <div className="text-sm text-blue-800">Total Rows</div>
                  </div>
                </div>

                {/* Invalid Rows */}
                {validationResults.invalidStudents.length > 0 && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">Invalid Rows:</h5>
                    <div className="max-h-48 overflow-auto border rounded-lg">
                      {validationResults.invalidStudents.map((invalid, index) => (
                        <div key={index} className="p-3 border-b border-gray-200 last:border-b-0">
                          <div className="text-sm font-medium text-gray-900">
                            Row {invalid.rowNumber}: {invalid.data['Roll Number']} - {invalid.data['Name']}
                          </div>
                          <div className="text-sm text-red-600">
                            {invalid.errors.join(', ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <button
                    onClick={() => setStep(2)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={validationResults.validStudents.length === 0}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Upload {validationResults.validStudents.length} Students
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Processing */}
            {step === 4 && (
              <div className="space-y-6 text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                  <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <h4 className="text-lg font-medium text-gray-900">Uploading Students...</h4>
                <p className="text-gray-600">Please wait while we process your file</p>
                
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-500">{uploadProgress}% complete</p>
              </div>
            )}

            {/* Step 5: Complete */}
            {step === 5 && uploadResults && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                    <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-medium text-gray-900">Upload Complete!</h4>
                  <p className="text-sm text-gray-600">Processing time: {uploadResults.processingTime}ms</p>
                </div>
                
                {/* Results Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {uploadResults.summary.addedCount}
                    </div>
                    <div className="text-sm text-green-800">Students Added</div>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {uploadResults.summary.skippedCount}
                    </div>
                    <div className="text-sm text-yellow-800">Skipped</div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {uploadResults.summary.errorCount}
                    </div>
                    <div className="text-sm text-red-800">Errors</div>
                  </div>
                </div>

                {/* Detailed Results */}
                {uploadResults.addedStudents && uploadResults.addedStudents.length > 0 && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">✅ Added Students ({uploadResults.addedStudents.length})</h5>
                    <div className="max-h-32 overflow-auto border rounded-lg">
                      {uploadResults.addedStudents.slice(0, 5).map((student, index) => (
                        <div key={index} className="p-2 border-b border-gray-200 last:border-b-0 text-sm">
                          <span className="font-medium">{student.rollNumber}</span> - {student.name} ({student.email})
                        </div>
                      ))}
                      {uploadResults.addedStudents.length > 5 && (
                        <div className="p-2 text-sm text-gray-500 text-center">
                          ... and {uploadResults.addedStudents.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {uploadResults.skippedStudents && uploadResults.skippedStudents.length > 0 && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">⚠️ Skipped Students ({uploadResults.skippedStudents.length})</h5>
                    <div className="max-h-32 overflow-auto border rounded-lg">
                      {uploadResults.skippedStudents.slice(0, 5).map((student, index) => (
                        <div key={index} className="p-2 border-b border-gray-200 last:border-b-0 text-sm">
                          <span className="font-medium">{student.rollNumber}</span> - {student.name} ({student.email})
                          <div className="text-xs text-yellow-600">{student.reason}</div>
                        </div>
                      ))}
                      {uploadResults.skippedStudents.length > 5 && (
                        <div className="p-2 text-sm text-gray-500 text-center">
                          ... and {uploadResults.skippedStudents.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {uploadResults.errorStudents && uploadResults.errorStudents.length > 0 && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">❌ Error Students ({uploadResults.errorStudents.length})</h5>
                    <div className="max-h-32 overflow-auto border rounded-lg">
                      {uploadResults.errorStudents.slice(0, 5).map((student, index) => (
                        <div key={index} className="p-2 border-b border-gray-200 last:border-b-0 text-sm">
                          <span className="font-medium">{student.rollNumber}</span> - {student.name} ({student.email})
                          <div className="text-xs text-red-600">{student.errors}</div>
                        </div>
                      ))}
                      {uploadResults.errorStudents.length > 5 && (
                        <div className="p-2 text-sm text-gray-500 text-center">
                          ... and {uploadResults.errorStudents.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-center">
                  <button
                    onClick={handleClose}
                    className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ show: false, message: '', type: 'success' })}
        />
      )}
    </>
  );
};

export default BulkUploadModal;
