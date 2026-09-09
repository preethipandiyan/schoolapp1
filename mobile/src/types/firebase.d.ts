declare module '../src/firebase/config' {
  export const auth: any;
  export const db: any;
  export const storage: any;
}

declare module '../src/firebase/firestore' {
  export const saveAttendance: any;
  export const getAttendance: any;
  export const createAssessment: any;
  export const getAssessmentsByClass: any;
  export const updateAssessmentGrades: any;
  export const addSubDocument: any;
  export const getSubCollection: any;
  export const updateSubDocument: any;
  export const sendMessage: any;
  export const subscribeToMessages: any;
  export const markChatRead: any;
}
