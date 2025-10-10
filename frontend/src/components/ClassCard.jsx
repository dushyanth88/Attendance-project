import { useClass } from '../context/ClassContext';

const ClassCard = ({ classData, isActive, onClick }) => {
  const { getClassDisplayName, getClassKey } = useClass();

  const handleClick = () => {
    onClick(classData);
  };

  return (
    <div
      className={`bg-white rounded-lg shadow-md p-6 cursor-pointer transition-all duration-200 hover:shadow-lg ${
        isActive 
          ? 'ring-2 ring-blue-500 bg-blue-50' 
          : 'hover:bg-gray-50'
      }`}
      onClick={handleClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <span className="text-2xl mr-3">🎓</span>
            <h3 className="text-lg font-semibold text-gray-900">
              {getClassDisplayName(classData)}
            </h3>
          </div>
          
          <div className="space-y-1 text-sm text-gray-600">
            <p><span className="font-medium">Batch:</span> {classData.batch}</p>
            <p><span className="font-medium">Department:</span> {classData.department || 'N/A'}</p>
            <p><span className="font-medium">Assigned:</span> {new Date(classData.assignedDate).toLocaleDateString()}</p>
          </div>
        </div>
        
        <div className="flex flex-col items-end">
          {isActive && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full mb-2">
              Active
            </span>
          )}
          
          <div className="text-right">
            <p className="text-sm text-gray-500">Class Key</p>
            <p className="text-xs text-gray-400 font-mono">{getClassKey(classData)}</p>
          </div>
        </div>
      </div>
      
      {/* Action indicators */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex space-x-2">
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
            📊 Attendance
          </span>
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
            👥 Students
          </span>
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
            📈 Reports
          </span>
        </div>
        
        <div className="text-right">
          <p className="text-xs text-gray-500">Click to manage</p>
        </div>
      </div>
    </div>
  );
};

export default ClassCard;