
// db.events.aggregate([
//     {
//         $match: {
//             event_type: 100
//         }
//     },
//     {
//         $project: {
//             yearWeek: { $dateToString: { format: "%Y-%U", date: "$timestamp"}}
//         }
//     },
//     {
//         $group: {
//             _id: {
//                 yearWeek: "$yearWeek"
//             },
//             count: {
//                 $sum: 1
//             },
//         }
//     },
//     {
//         $sort: {
//             _id: 1
//         }
//     }
// ])
